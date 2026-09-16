const $=s=>document.querySelector(s);
let factorId=null;
let enrollmentStarted=false;

function show(id){['signInForm','mfaPanel','deniedPanel','readyPanel'].forEach(x=>$("#"+x).hidden=x!==id)}
function status(message,type=''){const el=$('#status');el.textContent=message;el.className='status'+(type?' '+type:'')}

async function authApi(path,options={}){
  const headers={...(options.headers||{})};
  if(options.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
  const response=await fetch('/api/v1/auth/'+path,{...options,headers,credentials:'same-origin'});
  const ct=response.headers.get('content-type')||'';
  const body=ct.includes('application/json')?await response.json():await response.text();
  if(!response.ok)throw new Error(body?.detail||body||`HTTP ${response.status}`);
  return body;
}

function walk(value,visit){
  if(!value)return;
  if(Array.isArray(value)){value.forEach(v=>walk(v,visit));return}
  if(typeof value==='object'){
    visit(value);
    Object.values(value).forEach(v=>walk(v,visit));
  }
}
function findKey(root,key){let result=null;walk(root,obj=>{if(result===null&&Object.prototype.hasOwnProperty.call(obj,key)&&obj[key]!=null)result=obj[key]});return result}
function totpFactors(root){const out=[];const seen=new Set();walk(root,obj=>{
  const type=String(obj.factor_type||obj.type||'').toLowerCase();
  const id=obj.id||obj.factor_id;
  if(id&&(type==='totp'||obj.totp)&&!seen.has(id)){seen.add(id);out.push(obj)}
});return out}
function qrSource(qr){if(!qr)return'';const text=String(qr);if(text.startsWith('data:'))return text;if(text.trim().startsWith('<svg'))return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(text);return text}

async function routeSession(session){
  if(!session?.authenticated){status('Sign in to continue.');show('signInForm');return}
  if(session.mfa_verified){
    if(!Array.isArray(session.office_roles)||session.office_roles.length===0){
      status('Identity verified; Office role assignment is still required.','error');show('deniedPanel');return
    }
    status('Identity and MFA verified.','good');
    $('#identitySummary').textContent=`${session.email||'Authorized user'} · ${session.office_roles.join(', ')} · AAL2`;
    show('readyPanel');return
  }
  await prepareMfa();
}

async function prepareMfa(){
  status('Password accepted. Authenticator MFA is required.');
  show('mfaPanel');
  $('#enrollBox').hidden=true;
  const data=await authApi('factors');
  const factors=totpFactors(data);
  const verified=factors.find(x=>String(x.status||'').toLowerCase()==='verified');
  if(verified){
    factorId=verified.id||verified.factor_id;
    $('#mfaText').textContent='Enter the current code from your enrolled authenticator app.';
    $('#mfaCode').focus();
    return
  }
  if(enrollmentStarted)return;
  enrollmentStarted=true;
  status('No verified authenticator found. Creating a TOTP enrollment.');
  const enrolled=await authApi('mfa/enroll',{method:'POST',body:JSON.stringify({friendly_name:'KRAVIA Office Authenticator'})});
  factorId=findKey(enrolled,'id')||findKey(enrolled,'factor_id');
  const qr=findKey(enrolled,'qr_code');
  const secret=findKey(enrolled,'secret');
  if(!factorId)throw new Error('Authenticator enrollment did not return a factor ID');
  $('#enrollBox').hidden=false;
  if(qr){$('#qr').src=qrSource(qr);$('#qr').hidden=false}else{$('#qr').hidden=true}
  $('#secret').textContent=secret||'Use the QR code above';
  $('#mfaText').textContent='Scan the QR code, then enter the current authenticator code to verify enrollment.';
  $('#mfaCode').focus();
}

async function verifyMfa(code){
  if(!factorId)throw new Error('Authenticator factor is not ready');
  status('Verifying authenticator code…');
  const challenge=await authApi('mfa/challenge',{method:'POST',body:JSON.stringify({factor_id:factorId})});
  const challengeId=findKey(challenge,'id')||findKey(challenge,'challenge_id');
  if(!challengeId)throw new Error('MFA challenge could not be created');
  const session=await authApi('mfa/verify',{method:'POST',body:JSON.stringify({factor_id:factorId,challenge_id:challengeId,code})});
  await routeSession(session);
}

async function signOut(){
  try{await authApi('sign-out',{method:'POST'})}catch(_e){}
  factorId=null;enrollmentStarted=false;$('#signInForm').reset();$('#mfaForm').reset();
  status('Signed out.');show('signInForm');
}

$('#signInForm').addEventListener('submit',async event=>{
  event.preventDefault();
  status('Signing in…');
  const email=$('#email').value.trim(),password=$('#password').value;
  try{
    const session=await authApi('sign-in',{method:'POST',body:JSON.stringify({email,password})});
    $('#password').value='';
    await routeSession(session);
  }catch(error){status(error.message,'error');show('signInForm')}
});

$('#mfaForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const code=$('#mfaCode').value.trim();
  try{await verifyMfa(code)}catch(error){status(error.message,'error');$('#mfaCode').select()}
});

$('#continueBtn').addEventListener('click',()=>location.replace('/'));
$('#signOutReady').addEventListener('click',signOut);
$('#signOutDenied').addEventListener('click',signOut);

(async()=>{
  try{const session=await authApi('session');await routeSession(session)}
  catch(error){status(error.message,'error');show('signInForm')}
})();
