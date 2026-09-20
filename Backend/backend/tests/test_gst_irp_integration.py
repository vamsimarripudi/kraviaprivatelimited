import base64
import json
import os
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest
from cryptography.hazmat.primitives import padding as sym_padding, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from backend.gst_integration import (
    IRIS_AUTH_PATH,
    IRIS_GENERATE_IRN_PATH,
    IrisConfig,
    IrisIRPClient,
    GstProviderError,
    build_inv01_payload,
)


def _aes_encrypt(key: bytes, plaintext: bytes) -> bytes:
    padder = sym_padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    enc = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
    return enc.update(padded) + enc.finalize()


def _aes_decrypt(key: bytes, ciphertext: bytes) -> bytes:
    dec = Cipher(algorithms.AES(key), modes.ECB()).decryptor()
    padded = dec.update(ciphertext) + dec.finalize()
    unpadder = sym_padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()


def test_iris_core_auth_and_generate_irn_crypto_roundtrip():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    config = IrisConfig(
        environment="sandbox",
        base_url="https://sandbox.example.test",
        client_id="client",
        client_secret="secret",
        username="kravia-api",
        password="provider-password",
        gstin="37AANCK0043M1ZA",
        public_key_file="",
        public_key_b64=base64.b64encode(public_pem).decode(),
        timeout_seconds=2,
        einvoice_enabled=True,
        seller_address1="4-340 Salipeta",
        seller_location="Rajahmundry",
        seller_pin="533101",
        seller_trade_name="KRAVIA",
    )
    sek = os.urandom(32)
    seen = {"auth": False, "invoice": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == IRIS_AUTH_PATH:
            seen["auth"] = True
            body = json.loads(request.content)
            encrypted = base64.b64decode(body["Data"])
            auth_b64 = private_key.decrypt(encrypted, asym_padding.PKCS1v15())
            auth = json.loads(base64.b64decode(auth_b64))
            assert auth["UserName"] == "kravia-api"
            assert auth["Password"] == "provider-password"
            assert len(base64.b64decode(auth["AppKey"])) == 32
            app_key = base64.b64decode(auth["AppKey"])
            encrypted_sek = base64.b64encode(_aes_encrypt(app_key, base64.b64encode(sek))).decode()
            auth_data = {
                "AuthToken": "token-123",
                "Sek": encrypted_sek,
                "TokenExpiry": "2099-12-31 23:59:59",
            }
            return httpx.Response(200, json={"Status": 1, "Data": base64.b64encode(json.dumps(auth_data).encode()).decode()})

        if request.url.path == IRIS_GENERATE_IRN_PATH:
            seen["invoice"] = True
            assert request.headers["authtoken"] == "token-123"
            assert request.headers["user_name"] == "kravia-api"
            body = json.loads(request.content)
            decrypted = _aes_decrypt(sek, base64.b64decode(body["Data"]))
            payload = json.loads(base64.b64decode(decrypted))
            assert payload["Version"] == "1.1"
            assert payload["DocDtls"]["Typ"] == "INV"
            response_data = {
                "AckNo": "123456789",
                "AckDt": "20/09/2026 10:00:00",
                "Irn": "a" * 64,
                "SignedInvoice": "signed-invoice",
                "SignedQRCode": "signed-qr",
            }
            encoded = base64.b64encode(json.dumps(response_data, separators=(",", ":")).encode())
            encrypted_response = base64.b64encode(_aes_encrypt(sek, encoded)).decode()
            return httpx.Response(200, json={"Status": 1, "Data": encrypted_response})
        return httpx.Response(404)

    client = IrisIRPClient(config, transport=httpx.MockTransport(handler))
    try:
        result, response_hash = client.generate_irn({"Version": "1.1", "DocDtls": {"Typ": "INV"}})
    finally:
        client.close()
    assert seen == {"auth": True, "invoice": True}
    assert result["Irn"] == "a" * 64
    assert result["SignedQRCode"] == "signed-qr"
    assert len(response_hash) == 64


def test_invoice_payload_uses_canonical_gst_amounts_and_addresses():
    config = IrisConfig(
        environment="sandbox",
        base_url="https://sandbox.example.test",
        client_id="client",
        client_secret="secret",
        username="user",
        password="password",
        gstin="37AANCK0043M1ZA",
        public_key_file="unused",
        public_key_b64="",
        timeout_seconds=2,
        einvoice_enabled=True,
        seller_address1="4-340 Salipeta",
        seller_location="Rajahmundry",
        seller_pin="533101",
        seller_trade_name="KRAVIA",
    )
    invoice = SimpleNamespace(
        invoice_no="VL/2627/000001",
        issued_at=datetime(2026, 9, 20, tzinfo=timezone.utc),
        description="VidyaLuma hosted SaaS",
        sac="998319",
        qty_milli=1000,
        taxable_paise=100000,
        discount_paise=0,
        net_taxable_paise=100000,
        gst_rate_bps=1800,
        cgst_paise=9000,
        sgst_paise=9000,
        igst_paise=0,
        total_paise=118000,
    )
    customer = SimpleNamespace(
        gstin="37ABCDE1234F1Z5",
        country="India",
        legal_name="Example School",
        billing_address="School Road",
        billing_locality="Rajahmundry",
        billing_pincode="533101",
        state_code="37",
    )
    entity = SimpleNamespace(legal_name="KRAVIA PRIVATE LIMITED", state_code="37")
    payload = build_inv01_payload(invoice, customer, entity, config)
    assert payload["SellerDtls"]["Gstin"] == "37AANCK0043M1ZA"
    assert payload["BuyerDtls"]["Pin"] == 533101
    assert payload["ItemList"][0]["HsnCd"] == "998319"
    assert payload["ItemList"][0]["CgstAmt"] == 90.0
    assert payload["ItemList"][0]["SgstAmt"] == 90.0
    assert payload["ValDtls"]["TotInvVal"] == 1180.0


def test_invoice_payload_fails_closed_without_buyer_gstin():
    config = IrisConfig(
        environment="sandbox",
        base_url="https://sandbox.example.test",
        client_id="client",
        client_secret="secret",
        username="user",
        password="password",
        gstin="37AANCK0043M1ZA",
        public_key_file="unused",
        public_key_b64="",
        timeout_seconds=2,
        einvoice_enabled=True,
        seller_address1="4-340 Salipeta",
        seller_location="Rajahmundry",
        seller_pin="533101",
        seller_trade_name="",
    )
    invoice = SimpleNamespace(
        invoice_no="VL/2627/000001",
        issued_at=datetime(2026, 9, 20, tzinfo=timezone.utc),
        description="Service",
        sac="998319",
        qty_milli=1000,
        taxable_paise=100000,
        discount_paise=0,
        net_taxable_paise=100000,
        gst_rate_bps=1800,
        cgst_paise=9000,
        sgst_paise=9000,
        igst_paise=0,
        total_paise=118000,
    )
    customer = SimpleNamespace(
        gstin=None,
        country="India",
        legal_name="Unregistered Customer",
        billing_address="Road",
        billing_locality="Rajahmundry",
        billing_pincode="533101",
        state_code="37",
    )
    entity = SimpleNamespace(legal_name="KRAVIA PRIVATE LIMITED", state_code="37")
    with pytest.raises(GstProviderError, match="Customer GSTIN"):
        build_inv01_payload(invoice, customer, entity, config)
