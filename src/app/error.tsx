'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#08080d', color:'#f0f0f8', fontFamily:'sans-serif' }}>
      <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>⚠️ Error</div>
      <div style={{ fontSize:'0.875rem', color:'#9292b0', marginBottom:'2rem' }}>Algo salió mal</div>
      <button onClick={reset} style={{ padding:'0.5rem 1.5rem', background:'#f97316', color:'white', borderRadius:'8px', border:'none', cursor:'pointer' }}>
        Reintentar
      </button>
    </div>
  );
}
