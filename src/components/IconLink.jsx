export default function IconLink({ href, src, alt, size = 36, style = {} }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, verticalAlign: 'middle', overflow: 'hidden', fontSize: 0, ...style }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </a>
  );
}
