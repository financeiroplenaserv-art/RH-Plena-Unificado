import './LogoMarca.css'

interface LogoMarcaProps {
  size?: number
  alt?: string
  className?: string
}

export function LogoMarca({ size = 40, alt = 'Plena', className = '' }: LogoMarcaProps) {
  return (
    <div
      className={`logo-marca ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src="/corh_coracao_icone_azul.svg"
        alt=""
        className="coracao"
      />
      <img
        src="/logo_plena_30anos_redonda.png"
        alt={alt}
        className="logo"
      />
    </div>
  )
}
