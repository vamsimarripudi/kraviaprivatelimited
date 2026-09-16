#!/usr/bin/env python3
import argparse, hashlib, json, os, shutil, zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'assets'/'docs'
OUT=ROOT/'generated'
LEGAL_ENTITY=os.getenv('KRAVIA_LEGAL_NAME','KRAVIA PRIVATE LIMITED').strip()
KRAVIA_CIN=os.getenv('KRAVIA_CIN','').strip()

def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    if not KRAVIA_CIN:
        raise SystemExit('Inspection-pack generation requires controlled KRAVIA_CIN configuration.')
    ap=argparse.ArgumentParser(description='Generate a read-only KRAVIA Office evidence pack from controlled local documents.')
    ap.add_argument('--authority',default='INTERNAL_AUDIT')
    ap.add_argument('--reference',default='LOCAL-CONTROL-PACK')
    ap.add_argument('--period',default='N/A')
    args=ap.parse_args()
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    pack_id=f'INSP-{stamp}'
    work=OUT/pack_id
    work.mkdir(parents=True,exist_ok=False)
    records=[]
    for src in sorted(DOCS.iterdir()):
        if not src.is_file():
            continue
        dst=work/src.name
        shutil.copy2(src,dst)
        records.append({
            'filename':src.name,'bytes':src.stat().st_size,'sha256':sha256(src),
            'source':'controlled_workspace','copied_at':datetime.now(timezone.utc).isoformat()
        })
    manifest={
        'manifest_version':1,'pack_id':pack_id,'generated_at':datetime.now(timezone.utc).isoformat(),
        'legal_entity':LEGAL_ENTITY,'cin':KRAVIA_CIN,
        'authority':args.authority,'reference':args.reference,'period':args.period,
        'classification':'CONTROLLED_LOCAL_EVIDENCE_PACK','record_count':len(records),
        'warnings':['This pack contains controlled local evidence only. It is not proof of current filing/status unless the included source itself provides that proof.'],
        'records':records
    }
    (work/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    with (work/'document_hashes.csv').open('w',encoding='utf-8') as f:
        f.write('filename,bytes,sha256\n')
        for record in records:
            f.write(f'"{record["filename"]}",{record["bytes"]},{record["sha256"]}\n')
    index=['KRAVIA PRIVATE LIMITED — CONTROLLED EVIDENCE PACK','',f'Pack ID: {pack_id}',f'Authority: {args.authority}',f'Reference: {args.reference}',f'Period: {args.period}',f'Generated: {manifest["generated_at"]}','', 'DOCUMENTS']
    for number,record in enumerate(records,1):
        index.append(f'{number:02d}. {record["filename"]} | {record["bytes"]} bytes | SHA-256 {record["sha256"]}')
    index += ['', 'CONTROL NOTE', manifest['warnings'][0]]
    (work/'INDEX.txt').write_text('\n'.join(index),encoding='utf-8')
    archive=OUT/f'{pack_id}.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as zip_file:
        for path in work.rglob('*'):
            if path.is_file():
                zip_file.write(path,path.relative_to(work.parent))
    print(json.dumps({'pack_id':pack_id,'directory':str(work),'zip':str(archive),'record_count':len(records)},indent=2))

if __name__=='__main__':
    main()
