export default function IconLink({ href, src, alt }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-block', width: 36, height: 36}}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </a>
  );
}
