/* 을왕리 원정대 — GitHub Pages용 연결부.
   페이지 코드는 claude.use('db' | 'user' | 'downloads')로 저장소를 부릅니다.
   여기서 그 호출을 Firebase(Firestore + 익명 로그인)로 이어 줍니다.
   - 참여자: 열자마자 익명 로그인 → 로그인 화면 없이 투표·카풀·사진 제출 가능
   - 관리자: 페이지 맨 아래 '관리자 로그인'으로 구글 로그인 → 관리실이 열림 */
(function(){
  'use strict';
  var CFG=window.FIREBASE_CONFIG;
  var OWNER_HASH='a196b3baae58f25a3025c4a700708f64e9a09bd9118f2a8476b60e2677325e27'; // 관리자 구글 계정 이메일의 SHA-256
  var nul=function(){return Promise.resolve(null);};
  if(!CFG||!CFG.apiKey||!window.firebase){window.claude={use:nul};window.__ewrAdmin=null;return;}

  firebase.initializeApp(CFG);
  var auth=firebase.auth(),fs=firebase.firestore();

  var ready=new Promise(function(res){
    var done=false;var fin=function(u){if(!done){done=true;res(u||null);}};
    auth.onAuthStateChanged(function(u){
      if(u)fin(u);
      else auth.signInAnonymously().catch(function(e){console.error('[ewr] anonymous sign-in failed',e);fin(null);});
    });
    setTimeout(function(){fin(auth.currentUser);},12000);
  });
  var sha=function(s){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2);}).join('');});};
  var ownerP=ready.then(function(u){if(!u||u.isAnonymous||!u.email)return false;return sha(u.email.toLowerCase()).then(function(h){return h===OWNER_HASH;});}).catch(function(){return false;});

  var mapErr=function(e){var c=(e&&e.code)||'';return {code:c==='permission-denied'?'permission':(c==='unavailable'||c==='deadline-exceeded'?'unavailable':(c||'unknown')),message:e&&e.message};};
  var wrapDoc=function(d){return {id:d.id,exists:d.exists,data:function(){return d.data();},metadata:d.metadata};};
  var fail=function(e){throw mapErr(e);};

  function docRef(path){
    var r=fs.doc(path);
    return {
      onSnapshot:function(cb,err){return r.onSnapshot(function(d){cb(wrapDoc(d));},function(e){console.warn('[ewr]',path,e&&e.code);if(err)err(mapErr(e));});},
      get:function(){return r.get().then(wrapDoc,fail);},
      set:function(v){return r.set(v).catch(fail);},
      delete:function(){return r.delete().catch(fail);},
      acquire:function(o){
        var lk=fs.collection('locks').doc(path.replace(/\//g,'__')),now=Date.now();o=o||{};
        return fs.runTransaction(function(t){return t.get(lk).then(function(s){var d=s.exists?s.data():null;
          if(d&&d.exp>now&&d.holder!==o.holder)return {acquired:false};
          t.set(lk,{holder:String(o.holder||''),exp:now+(o.ttlMs||5000)});return {acquired:true};});}).catch(fail);
      }
    };
  }
  function colRef(name){
    var r=fs.collection(name);
    return {
      onSnapshot:function(cb,err){return r.onSnapshot(function(s){cb({docs:s.docs.map(wrapDoc),metadata:s.metadata});},function(e){console.warn('[ewr]',name,e&&e.code);if(err)err(mapErr(e));});},
      doc:function(id){return docRef(name+'/'+id);}
    };
  }
  var db={collection:colRef,doc:docRef};
  var user={
    isOwner:function(){return ownerP;},
    canEdit:function(){return ownerP;},
    id:function(){return ready.then(function(u){return u?u.uid:null;});},
    can:function(){return ready.then(function(u){return !!u;});}
  };
  var downloads={save:function(o){
    try{var blob=o.data instanceof Blob?o.data:new Blob([o.data]);var u=URL.createObjectURL(blob);var a=document.createElement('a');
      a.href=u;a.download=o.filename||'download';document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(u);a.remove();},2000);return Promise.resolve({status:'saved'});}
    catch(e){return Promise.reject({code:'unavailable',message:String(e)});}
  }};
  window.claude={use:function(n){
    if(n==='db')return ready.then(function(u){return u?db:null;});
    if(n==='user')return Promise.resolve(user);
    if(n==='downloads')return Promise.resolve(downloads);
    return nul();
  }};
  window.__ewrAdmin={
    isOwner:function(){return ownerP;},
    login:function(){var p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
      return auth.signInWithPopup(p).then(function(){location.reload();},function(e){console.error('[ewr] google sign-in',e);throw e;});},
    logout:function(){return auth.signOut().then(function(){location.reload();});}
  };
})();
