export default function NotFound() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#08080d', color:'#f0f0f8', fontFamily:'sans-serif' }}>
      <div style={{ fontSize:'4rem', marginBottom:'1rem' }}>404</div>
      <div style={{ fontSize:'1rem', color:'#9292b0', marginBottom:'2rem' }}>Página no encontrada</div>
      <a href="/login" style={{ padding:'0.5rem 1.5rem', background:'#f97316', color:'white', borderRadius:'8px', textDecoration:'none', fontSize:'0.875rem' }}>
        Ir al inicio →
      </a>
    </div>
  );
}
