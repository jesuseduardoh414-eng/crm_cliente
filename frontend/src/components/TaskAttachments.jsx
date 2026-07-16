import { useEffect, useMemo, useState } from 'react';
import { adjuntosService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Archive,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PanelSkeleton } from './Skeleton';

const buildTempId = (file, index) => `${file.name}-${file.size}-${file.lastModified}-${index}`;

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getPreviewKind = (tipo = '', nombre = '') => {
  const lowerName = String(nombre).toLowerCase();
  if (tipo.includes('image')) return 'image';
  if (tipo.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    tipo.includes('text') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.json')
  ) return 'text';
  return 'file';
};

const getFileIcon = (tipo = '', nombre = '') => {
  const lowerName = String(nombre).toLowerCase();
  if (tipo.includes('image')) return <ImageIcon size={20} />;
  if (tipo.includes('pdf') || lowerName.endsWith('.pdf')) return <FileText size={20} style={{ color: '#ef4444' }} />;
  if (
    tipo.includes('word') ||
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx')
  ) return <FileText size={20} style={{ color: 'var(--color-primary-light)' }} />;
  if (
    tipo.includes('excel') ||
    tipo.includes('spreadsheet') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.csv')
  ) return <FileSpreadsheet size={20} style={{ color: '#10b981' }} />;
  if (
    tipo.includes('zip') ||
    tipo.includes('rar') ||
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.rar') ||
    lowerName.endsWith('.7z')
  ) return <Archive size={20} />;
  return <File size={20} />;
};

const PreviewCard = ({ item, isPending = false, canDelete = false, onDelete }) => {
  const kind = getPreviewKind(item.tipo, item.nombre);
  const previewUrl = item.previewUrl || (item.url ? adjuntosService.getPreviewUrl(item.url) : null);

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: '1rem',
      background: 'var(--color-surface)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '220px',
      boxShadow: '0 10px 25px rgba(15,23,42,0.05)'
    }}>
      <div style={{
        height: '128px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {kind === 'image' && previewUrl ? (
          <img src={previewUrl} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : kind === 'pdf' && previewUrl ? (
          <iframe title={item.nombre} src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
            {getFileIcon(item.tipo, item.nombre)}
            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {kind === 'text' ? 'Documento' : 'Archivo'}
            </span>
          </div>
        )}
        {isPending && (
          <span style={{
            position: 'absolute',
            top: '0.6rem',
            left: '0.6rem',
            fontSize: '0.65rem',
            fontWeight: '900',
            background: 'rgb(var(--brand-100))',
            color: 'var(--color-primary-dark)',
            padding: '0.25rem 0.5rem',
            borderRadius: '999px'
          }}>
            Nuevo
          </span>
        )}
      </div>

      <div style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <div title={item.nombre} style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--color-text)', wordBreak: 'break-word' }}>
              {item.nombre}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              {formatSize(item.tamano || item.size)}{item.creadoEn ? ` • ${new Date(item.creadoEn).toLocaleDateString()}` : ''}
            </div>
          </div>
          {canDelete && (
            <button type="button" onClick={onDelete} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>
              {isPending ? <X size={16} /> : <Trash2 size={16} />}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '0.6rem',
                borderRadius: '0.75rem',
                background: 'rgb(var(--brand-50))',
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                fontWeight: '900',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <Eye size={14} /> Ver
            </a>
          )}
          {!isPending && item.url && (
            <button
              type="button"
              onClick={() => adjuntosService.descargar(item.url)}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '0.75rem',
                border: '1px solid #cbd5e1',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '0.75rem',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >
              Descargar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskAttachments = ({
  tareaId,
  type = 'tareas',
  title,
  pendingFiles = [],
  onPendingFilesChange,
  onAttachmentsChange,
  showUploader = true,
  showExisting = true,
  uploadLabel = 'Subir archivos',
}) => {
  const { usuario } = useAuth();
  const [adjuntos, setAdjuntos] = useState([]);
  const [cargando, setCargando] = useState(Boolean(tareaId && showExisting));
  const [subiendo, setSubiendo] = useState(false);

  const tempFiles = useMemo(
    () => pendingFiles.map((file, index) => ({
      id: buildTempId(file, index),
      nombre: file.name,
      tipo: file.type,
      tamano: file.size,
      previewUrl: file.type?.startsWith('image/') || file.type === 'application/pdf'
        ? URL.createObjectURL(file)
        : null,
    })),
    [pendingFiles]
  );

  useEffect(() => () => {
    tempFiles.forEach((file) => {
      if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    });
  }, [tempFiles]);

  const fetchAdjuntos = async () => {
    if (!tareaId || !showExisting) {
      setCargando(false);
      return;
    }

    try {
      const data = await adjuntosService.listar(tareaId, type);
      const nextAdjuntos = data.adjuntos || [];
      setAdjuntos(nextAdjuntos);
      onAttachmentsChange?.(nextAdjuntos);
    } catch (error) {
      console.error('Error al cargar adjuntos:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchAdjuntos();
  }, [tareaId, type, showExisting]);

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (tareaId) {
      setSubiendo(true);
      try {
        const data = await adjuntosService.subir(tareaId, files, type);
        const nuevosAdjuntos = data.adjuntos || (data.adjunto ? [data.adjunto] : []);
        setAdjuntos((prev) => {
          const nextAdjuntos = [...nuevosAdjuntos, ...prev];
          onAttachmentsChange?.(nextAdjuntos);
          return nextAdjuntos;
        });
      } catch (error) {
        alert(error.message);
      } finally {
        setSubiendo(false);
      }
    } else if (onPendingFilesChange) {
      onPendingFilesChange((prev) => [...prev, ...files]);
    }

    event.target.value = '';
  };

  const handleEliminar = async (id) => {
    if (!confirm('Eliminar este archivo?')) return;
    try {
      await adjuntosService.eliminar(id);
      setAdjuntos((prev) => {
        const nextAdjuntos = prev.filter((a) => a.id !== id);
        onAttachmentsChange?.(nextAdjuntos);
        return nextAdjuntos;
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const removePendingFile = (targetId) => {
    if (!onPendingFilesChange) return;
    onPendingFilesChange((prev) =>
      prev.filter((file, index) => buildTempId(file, index) !== targetId)
    );
  };

  if (cargando) return <PanelSkeleton rows={3} titleWidth="170px" />;

  const allItems = [
    ...tempFiles.map((file) => ({ ...file, isPending: true })),
    ...adjuntos.map((file) => ({ ...file, isPending: false })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Paperclip size={18} />
          <h4 style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--color-text)' }}>
            {title || (type === 'proyectos' ? 'Documentos del Proyecto' : type === 'agenda' ? 'Documentos del Evento' : 'Archivos Adjuntos')}
          </h4>
        </div>

        {showUploader && (
          <label style={{
            background: '#0f172a',
            color: '#fff',
            borderRadius: '0.8rem',
            padding: '0.7rem 1rem',
            cursor: subiendo ? 'wait' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: '900',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            opacity: subiendo ? 0.7 : 1
          }}>
            <Upload size={14} />
            {subiendo ? 'Subiendo...' : uploadLabel}
            <input type="file" multiple onChange={handleFilesSelected} disabled={subiendo} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {showUploader && (
        <div style={{
          padding: '1rem',
          border: '1px dashed #cbd5e1',
          borderRadius: '1rem',
          background: '#f8fafc',
          fontSize: '0.78rem',
          color: 'var(--color-text-muted)',
          fontWeight: '700'
        }}>
          Puedes subir varios archivos a la vez: imágenes, PDF, Word, Excel, TXT y más.
        </div>
      )}

      {allItems.length === 0 ? (
        <div style={{
          padding: '1.5rem',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '0.75rem',
          border: '1px dashed var(--color-border)',
          color: 'var(--color-text-muted)'
        }}>
          Sin documentos adjuntos.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {allItems.map((item) => {
            const canDelete = item.isPending || item.usuarioId === usuario?.id || usuario?.rol === 'ADMIN';
            return (
              <PreviewCard
                key={item.id || item.url}
                item={item}
                isPending={item.isPending}
                canDelete={canDelete}
                onDelete={() => (item.isPending ? removePendingFile(item.id) : handleEliminar(item.id))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskAttachments;
