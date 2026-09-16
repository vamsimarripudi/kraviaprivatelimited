from io import BytesIO
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT

NAVY=colors.HexColor('#102A43'); TEAL=colors.HexColor('#155E75'); BORDER=colors.HexColor('#D9E2E8'); LIGHT=colors.HexColor('#F5F8FA'); MUTED=colors.HexColor('#64748B')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='InvCompany',parent=styles['Normal'],fontName='Helvetica-Bold',fontSize=15,leading=18,textColor=NAVY))
styles.add(ParagraphStyle(name='InvTitle',parent=styles['Normal'],fontName='Helvetica-Bold',fontSize=20,leading=23,textColor=NAVY,alignment=TA_RIGHT))
styles.add(ParagraphStyle(name='InvBody',parent=styles['Normal'],fontName='Helvetica',fontSize=7.7,leading=10.5,textColor=colors.HexColor('#111827')))
styles.add(ParagraphStyle(name='InvSmall',parent=styles['Normal'],fontName='Helvetica',fontSize=6.6,leading=9,textColor=MUTED))
styles.add(ParagraphStyle(name='InvHead',parent=styles['Normal'],fontName='Helvetica-Bold',fontSize=7.5,leading=9.5,textColor=TEAL))
styles.add(ParagraphStyle(name='InvRight',parent=styles['Normal'],fontName='Helvetica',fontSize=7.7,leading=10.5,alignment=TA_RIGHT))

def p(text,style='InvBody'):
    text=str(text or '').replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('\n','<br/>')
    return Paragraph(text,styles[style])

def money(paise):
    return f"INR {Decimal(int(paise))/Decimal(100):,.2f}"

def invoice_pdf(invoice, company, customer, product, gstin=None, verification_base=None):
    out=BytesIO()
    doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=15*mm,rightMargin=15*mm,topMargin=13*mm,bottomMargin=15*mm,title=f"Tax Invoice {invoice.invoice_no}")
    story=[]
    head=Table([[p(company.legal_name,'InvCompany'),p('TAX INVOICE','InvTitle')],[p(f"CIN  {company.cin}\n{company.registered_office}\nGSTIN  {gstin or 'NOT PRODUCTION-LOCKED'}",'InvSmall'),p(f"Invoice  {invoice.invoice_no}\nIssued  {invoice.issued_at.date().isoformat()}\nDue  {invoice.due_date or '—'}\nStatus  {invoice.status}",'InvRight')]],colWidths=[108*mm,72*mm])
    head.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [head,Spacer(1,3*mm)]
    meta=Table([[p('BILL TO','InvHead'),p('INVOICE DETAILS','InvHead')],[p(f"{customer.legal_name}\n{customer.billing_address or ''}\nGSTIN  {customer.gstin or 'UNREGISTERED / NOT PROVIDED'}\n{customer.state} ({customer.state_code})"),p(f"Product  {product.name}\nSAC  {invoice.sac or '—'}\nGST rate  {Decimal(invoice.gst_rate_bps)/100}%\nCurrency  {invoice.currency}")]],colWidths=[90*mm,90*mm])
    meta.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,BORDER),('BACKGROUND',(0,0),(-1,0),LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),6)]))
    story += [meta,Spacer(1,3*mm)]
    items=Table([[p('#'),p('DESCRIPTION'),p('SAC'),p('QTY'),p('TAXABLE','InvRight')],[p('01'),p(invoice.description),p(invoice.sac or '—'),p(str(Decimal(invoice.qty_milli)/1000)),p(money(invoice.net_taxable_paise),'InvRight')]],colWidths=[10*mm,91*mm,20*mm,15*mm,44*mm])
    items.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,BORDER),('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),colors.white),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),5)]))
    story += [items]
    rows=[('Taxable value',invoice.net_taxable_paise)]
    if invoice.cgst_paise: rows += [('CGST',invoice.cgst_paise),('SGST',invoice.sgst_paise)]
    if invoice.igst_paise: rows += [('IGST',invoice.igst_paise)]
    rows += [('TOTAL',invoice.total_paise),('Paid',invoice.paid_paise),('Balance due',invoice.balance_paise)]
    st=Table([[p(a,'InvHead' if a in ('TOTAL','Balance due') else 'InvBody'),p(money(v),'InvRight')] for a,v in rows],colWidths=[45*mm,45*mm],hAlign='RIGHT')
    st.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,BORDER),('BACKGROUND',(0,len(rows)-3),(-1,len(rows)-3),LIGHT),('BACKGROUND',(0,len(rows)-1),(-1,len(rows)-1),LIGHT),('PADDING',(0,0),(-1,-1),5)]))
    story += [st,Spacer(1,5*mm)]
    verify=f"Verify: {verification_base.rstrip('/')}/verify/invoice/{invoice.invoice_no}" if verification_base else "Verification endpoint available through KRAVIA Office when deployed."
    story += [p(f"Document hash: {invoice.document_hash}\n{verify}",'InvSmall')]
    if not gstin:
        story += [Spacer(1,2*mm),p('CONTROL: This development document is not for production tax issue until KRAVIA GST registration and tax configuration are formally production-locked.','InvSmall')]
    doc.build(story)
    out.seek(0)
    return out

def receipt_pdf(receipt, payment, invoice, company, customer):
    out=BytesIO(); doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,topMargin=18*mm,bottomMargin=18*mm,title=f"Receipt {receipt.receipt_no}")
    story=[p(company.legal_name,'InvCompany'),p('PAYMENT RECEIPT','InvTitle'),Spacer(1,8*mm)]
    t=Table([[p('Receipt No.','InvHead'),p(receipt.receipt_no),p('Issued','InvHead'),p(receipt.issued_at.date().isoformat())],[p('Received from','InvHead'),p(customer.legal_name),p('Amount','InvHead'),p(money(receipt.amount_paise),'InvRight')],[p('Invoice','InvHead'),p(invoice.invoice_no),p('Method','InvHead'),p(payment.method)],[p('Reference','InvHead'),p(payment.external_reference or '—'),p('Payment date','InvHead'),p(payment.received_date)]],colWidths=[30*mm,60*mm,30*mm,55*mm])
    t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,BORDER),('BACKGROUND',(0,0),(0,-1),LIGHT),('BACKGROUND',(2,0),(2,-1),LIGHT),('PADDING',(0,0),(-1,-1),6),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story += [t,Spacer(1,8*mm),p('This receipt acknowledges payment against the referenced invoice and does not replace the original tax invoice.','InvSmall')]
    doc.build(story); out.seek(0); return out

def ctc_pdf(resolution, meeting, company):
    out=BytesIO(); doc=SimpleDocTemplate(out,pagesize=A4,leftMargin=19*mm,rightMargin=19*mm,topMargin=18*mm,bottomMargin=18*mm,title=f"CTC {resolution.resolution_no}")
    story=[p(company.legal_name,'InvCompany'),p(f"CIN: {company.cin}",'InvSmall'),p(company.registered_office,'InvSmall'),Spacer(1,8*mm),p('CERTIFIED TRUE COPY OF THE BOARD RESOLUTION','InvTitle'),Spacer(1,5*mm),p(f"Certified True Copy of the resolution approved at {meeting.meeting_no} held on {meeting.meeting_date}."),Spacer(1,5*mm),p(resolution.title,'InvHead'),Spacer(1,3*mm),p(resolution.resolution_text),Spacer(1,8*mm),p(f"Resolution No.: {resolution.resolution_no}\nContent SHA-256: {resolution.content_hash}",'InvSmall'),Spacer(1,14*mm),p("For KRAVIA PRIVATE LIMITED\n\n\n____________________________\nAuthorised Director / Certifying Officer\nName: [to be completed at execution]\nDate: [___]\nPlace: [___]")]
    doc.build(story); out.seek(0); return out
