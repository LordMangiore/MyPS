import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'

const BRAND_BLUE = '#003087'

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  buttonStyle,
  size = 'md',
  fullWidth = false,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selected = options.find(o => o.value === value)
  const padY = size === 'sm' ? 'py-2' : 'py-2.5'
  const padX = size === 'sm' ? 'px-3' : 'px-3.5'
  const text = size === 'sm' ? 'text-sm' : 'text-[15px]'

  return (
    <div ref={ref} className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${fullWidth ? 'w-full' : ''} ${padX} ${padY} ${text} bg-white border border-neutral-300 rounded-md flex items-center justify-between gap-2 text-left hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
        style={buttonStyle}
      >
        <span className={`truncate ${selected ? 'text-neutral-900' : 'text-neutral-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 min-w-full bg-white border border-neutral-200 rounded-md shadow-xl max-h-72 overflow-auto py-1"
          role="listbox"
        >
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-[15px] text-left hover:bg-neutral-100 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                style={isSelected ? { color: BRAND_BLUE, fontWeight: 600 } : { color: '#404040' }}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={16} style={{ color: BRAND_BLUE }} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
