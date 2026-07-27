import { useEffect, useRef, useState } from 'react';

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const controlsRef = useRef(null);
  const lastValueRef = useRef('');
  const repeatCountRef = useRef(0);
  const [error, setError] = useState('');
  const [scannerMode, setScannerMode] = useState('Preparando cámara...');
  const [detectedValue, setDetectedValue] = useState('');
  const [manualValue, setManualValue] = useState('');

  function normalizeScannedCode(value) {
    return String(value || '')
      .trim()
      .split(String.fromCharCode(10)).join('')
      .split(String.fromCharCode(13)).join('')
      .split(String.fromCharCode(9)).join('')
      .split(' ').join('');
  }

  function stopEverything() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (controlsRef.current?.stop) controlsRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  function acceptValue(value) {
    const normalized = normalizeScannedCode(value);
    if (!normalized) return;

    stopEverything();
    onScan(normalized);
    onClose();
  }

  function registerCandidate(value) {
    const normalized = normalizeScannedCode(value);

    if (!normalized || normalized.length < 4) return;

    if (lastValueRef.current === normalized) {
      repeatCountRef.current += 1;
    } else {
      lastValueRef.current = normalized;
      repeatCountRef.current = 1;
    }

    if (repeatCountRef.current >= 2) {
      stopEverything();
      setDetectedValue(normalized);
    }
  }

  useEffect(() => {
    let active = true;

    async function startNativeScanner() {
      setScannerMode('Escáner nativo');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        },
        audio: false,
      });

      if (!active) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
      });

      const scan = async () => {
        if (!active || detectedValue || !videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);

          if (codes.length > 0) {
            registerCandidate(codes[0]?.rawValue || '');
          }
        } catch {
          // Sigue intentando mientras la cámara esté activa.
        }

        animationRef.current = requestAnimationFrame(scan);
      };

      scan();
    }

    async function startZxingScanner() {
      setScannerMode('Escáner compatible con iPhone');

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();

      const controls = await codeReader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' }],
          },
          audio: false,
        },
        videoRef.current,
        result => {
          if (!active || detectedValue || !result) return;

          const value = result.getText?.() || String(result.text || '');

          registerCandidate(value);
        }
      );

      controlsRef.current = controls;
    }

    async function startScanner() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Este navegador no permite acceder a la cámara. Prueba desde un navegador actualizado y con la página en HTTPS.');
          return;
        }

        if ('BarcodeDetector' in window) {
          await startNativeScanner();
          return;
        }

        await startZxingScanner();
      } catch (err) {
        console.error('Error iniciando escáner:', err);
        setError('No se pudo abrir el escáner. Revisa permisos de cámara, usa la página oficial en HTTPS y vuelve a intentar.');
      }
    }

    startScanner();

    return () => {
      active = false;
      stopEverything();
    };
  }, []);

  function retryScan() {
    lastValueRef.current = '';
    repeatCountRef.current = 0;
    setDetectedValue('');
    setManualValue('');
    onClose();
  }

  return (
    <div className="iq-modal-overlay">
      <div className="iq-modal-card w-full max-w-md p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Escanear código</h3>
            <p className="text-sm text-slate-500">Apunta la cámara al código de barras del producto.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopEverything();
              onClose();
            }}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error}</div>
        ) : detectedValue ? (
          <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-center">
            <p className="text-sm font-bold text-cyan-800">Código detectado</p>
            <p className="mt-2 break-all text-2xl font-extrabold text-cyan-950">{detectedValue}</p>
            <p className="mt-2 text-xs text-cyan-800">Confirma que coincida con el número impreso debajo del código.</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => acceptValue(detectedValue)}
                className="rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-800"
              >
                Usar código
              </button>
              <button
                type="button"
                onClick={retryScan}
                className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-cyan-800 hover:bg-cyan-50"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-slate-950">
            <video ref={videoRef} playsInline muted className="h-72 w-full object-cover" />
          </div>
        )}

        {!error && !detectedValue && (
          <p className="mt-3 text-center text-xs font-bold text-cyan-800">{scannerMode}</p>
        )}

        <div className="mt-4 rounded-2xl bg-slate-50 p-3">
          <p className="text-center text-xs text-slate-500">Si la lectura no coincide, escribe el código manualmente.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={manualValue}
              onChange={e => setManualValue(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
              placeholder="Código manual"
            />
            <button
              type="button"
              onClick={() => acceptValue(manualValue)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
            >
              Usar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}