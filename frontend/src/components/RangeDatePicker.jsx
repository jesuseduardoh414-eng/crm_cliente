import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar as CalendarIcon, X, Check } from 'lucide-react';

const RangeDatePicker = ({
  from,
  to,
  onChange,
  placeholder = 'Seleccionar fecha',
  title = 'Seleccionar fecha',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const range = { from, to };

  const handleSelect = (newRange) => {
    onChange(newRange);
  };

  const displayText = from && to
    ? `${format(from, 'dd MMM', { locale: es })} - ${format(to, 'dd MMM', { locale: es })}`
    : from
      ? `${format(from, 'dd MMM', { locale: es })} - ...`
      : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
          fontWeight: '700',
          color: 'var(--color-text)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left',
        }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-40)'; }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
      >
        <CalendarIcon size={18} style={{ color: 'var(--color-primary)', opacity: 0.8 }} />
        <span style={{ flex: 1 }}>{displayText}</span>
      </button>

      {isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .rdp { --rdp-accent-color: var(--color-primary); --rdp-background-color: var(--color-primary-10); margin: 0 auto; }
            .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background-color: var(--color-primary); color: white; }
          `}</style>

          <div
            style={{
              background: 'var(--color-surface)',
              width: '100%',
              maxWidth: '400px',
              borderRadius: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--color-text)', margin: 0 }}>{title}</h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', padding: '0.5rem' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <DayPicker
                mode="range"
                selected={range}
                onSelect={handleSelect}
                locale={es}
                numberOfMonths={1}
              />

              <div
                style={{
                  marginTop: '1.5rem',
                  width: '100%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  justifyContent: 'center',
                }}
              >
                {[
                  { label: 'Hoy', val: 0 },
                  { label: 'Manana', val: 1 },
                  { label: '3 dias', val: 3 },
                  { label: '1 semana', val: 7 },
                  { label: '2 semanas', val: 14 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      const selectedFrom = addDays(new Date(), preset.val);
                      onChange({ from: selectedFrom, to: selectedFrom });
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-2)',
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      color: 'var(--color-text-dim)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ flex: 1, padding: '1rem', borderRadius: '1rem', border: '1px solid var(--color-border)', background: 'none', fontSize: '0.8rem', fontWeight: '800', color: 'var(--color-text-dim)', cursor: 'pointer' }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ flex: 2, padding: '1rem', borderRadius: '1rem', border: 'none', background: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: '900', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                Confirmar <Check size={18} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default RangeDatePicker;
