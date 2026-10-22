import React, { useState, useEffect, useRef } from 'react';
import { X, Smartphone, Copy, Check, ExternalLink, Download, RefreshCw, Globe } from 'lucide-react';
import QRCode from 'qrcode';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSatelliteHere: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  onOpenSatelliteHere
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [urlType, setUrlType] = useState<'shared' | 'current'>('shared');
  const [isGenerating, setIsGenerating] = useState(false);

  // The permanent shared URL accessible from external mobile networks / 4G
  const sharedBaseUrl = 'https://ais-pre-bdahy7ontjrrapyfilywqt-652582632173.us-east1.run.app';

  // Compute final satellite link based on user selection
  const currentBaseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : sharedBaseUrl;

  const targetUrl = urlType === 'shared'
    ? `${sharedBaseUrl}?mode=satellite`
    : `${currentBaseUrl}?mode=satellite`;

  useEffect(() => {
    if (!isOpen) return;

    setIsGenerating(true);
    // Generate valid, standard QR code with error correction level M and clean margin
    QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#020617', // Slate-950 dark modules
        light: '#FFFFFF' // Crisp white background
      }
    })
      .then((dataUri) => {
        setQrDataUrl(dataUri);
        setIsGenerating(false);
      })
      .catch((err) => {
        console.error('Error al generar código QR:', err);
        setIsGenerating(false);
      });
  }, [isOpen, targetUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'Codigo_QR_PrevRiesgos_Satelite_Terreno.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4 my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Código QR para Celulares de Terreno
              </h3>
              <p className="text-xs text-slate-400">
                Formato estándar ISO/IEC reconocido por cualquier dispositivo móvil
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* URL Target Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setUrlType('shared')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              urlType === 'shared'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Enlace Compartido (Red Móvil / 4G)</span>
          </button>
          <button
            type="button"
            onClick={() => setUrlType('current')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer ${
              urlType === 'current'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Enlace Actual</span>
          </button>
        </div>

        {/* Real Standard QR Code Display */}
        <div className="flex flex-col items-center justify-center p-5 bg-white rounded-xl shadow-inner min-h-[260px]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-2 text-slate-700">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs font-semibold">Generando código QR...</span>
            </div>
          ) : qrDataUrl ? (
            <>
              <img
                src={qrDataUrl}
                alt="Código QR estándar de la Aplicación Satélite Terreno"
                className="w-56 h-56 object-contain rounded"
              />
              <span className="text-slate-800 text-[11px] font-bold mt-2 font-mono text-center">
                Apunta la cámara de cualquier celular iPhone o Android
              </span>
            </>
          ) : (
            <div className="text-xs text-rose-500">Error al codificar QR</div>
          )}
        </div>

        {/* Scannable Target URL display with copy */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Enlace codificado en el QR:</span>
            <button
              onClick={handleCopy}
              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-slate-300 break-all select-all bg-slate-900 p-2 rounded border border-slate-800">
            {targetUrl}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Descargar PNG</span>
            </button>

            <button
              type="button"
              onClick={onOpenSatelliteHere}
              className="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-950 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-950" />
              <span>Abrir Aquí</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center pt-1">
            Puedes imprimir este código QR y pegarlo en el pañol de herramientas o casilleros para que los operarios reporten al instante.
          </p>
        </div>
      </div>
    </div>
  );
};
