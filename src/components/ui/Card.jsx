const VARIANTS = {
  data: 'rounded-xl border border-surface-line bg-surface-raised p-5',
  advisor: 'rounded-xl border border-surface-line bg-surface-raised border-l-[3px] border-l-beane-green p-5',
  identity: 'rounded-[20px] border border-white/5 ring-1 ring-white/5 bg-gradient-to-b from-surface-overlay to-surface-base p-9 pb-7 text-center',
}

export default function Card({ variant = 'data', as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
