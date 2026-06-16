import React, { useState, useRef, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function App() {
  // --- STATE DEFINITIONS ---
  const [sections, setSections] = useState({
    art: { id: 'art', name: 'Art', image: null, defaultBgColor: '#c51d24', textColor: '#ffffff' },
    artist: { id: 'artist', name: 'Artist', image: null, defaultBgColor: '#000000', textColor: '#ffffff' },
    tools: { id: 'tools', name: 'Tools', image: null, defaultBgColor: '#ffffff', textColor: '#000000' }
  });

  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef(null);

  // --- CROP MODAL STATE ---
  const [cropTarget, setCropTarget] = useState(null); // null or { sectionId, imageSrc }
  const [zoom, setZoom] = useState(1.0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 450, height: 200 });

  const viewportRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const translateStartRef = useRef({ x: 0, y: 0 });

  // --- MEASURE VIEWPORT ON OPEN ---
  useEffect(() => {
    if (cropTarget && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setViewportSize({
          width: rect.width,
          height: rect.height
        });
      }
    }
  }, [cropTarget]);

  // --- IMAGE UPLOAD HANDLERS ---
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && fileInputRef.current?.dataset?.sectionId) {
      const sectionId = fileInputRef.current.dataset.sectionId;
      const reader = new FileReader();
      reader.onload = (event) => {
        setCropTarget({
          sectionId,
          imageSrc: event.target.result
        });
        setZoom(1.0);
        setTranslate({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = (sectionId, e) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.dataset.sectionId = sectionId;
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // --- MATH FOR CROPPING COORDINATES ---
  const getCropperLayout = () => {
    if (imgSize.width === 0 || imgSize.height === 0) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }

    const scaleX = viewportSize.width / imgSize.width;
    const scaleY = viewportSize.height / imgSize.height;
    const baseScale = Math.max(scaleX, scaleY);
    const finalScale = baseScale * zoom;

    const w = imgSize.width * finalScale;
    const h = imgSize.height * finalScale;

    const defaultLeft = (viewportSize.width - w) / 2;
    const defaultTop = (viewportSize.height - h) / 2;

    const left = Math.min(0, Math.max(viewportSize.width - w, defaultLeft + translate.x));
    const top = Math.min(0, Math.max(viewportSize.height - h, defaultTop + translate.y));

    return {
      width: w,
      height: h,
      left,
      top,
      scale: finalScale
    };
  };

  const layout = getCropperLayout();

  // --- CROP DRAG HANDLERS ---
  const handleCropMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    translateStartRef.current = { ...translate };
  };

  const handleCropMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setTranslate({
      x: translateStartRef.current.x + dx,
      y: translateStartRef.current.y + dy
    });
  };

  const handleCropMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCropTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    translateStartRef.current = { ...translate };
  };

  const handleCropTouchMove = (e) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setTranslate({
      x: translateStartRef.current.x + dx,
      y: translateStartRef.current.y + dy
    });
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // --- CROP AND SAVE HANDLER ---
  const handleSaveCrop = () => {
    if (!cropTarget || imgSize.width === 0 || imgSize.height === 0) return;

    const targetWidth = 1500;
    const targetHeight = 667;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      alert('Could not initialize canvas context');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const drawScale = targetWidth / viewportSize.width;
      
      const highResW = layout.width * drawScale;
      const highResH = layout.height * drawScale;
      const highResX = layout.left * drawScale;
      const highResY = layout.top * drawScale;

      ctx.drawImage(img, highResX, highResY, highResW, highResH);

      setSections(prev => ({
        ...prev,
        [cropTarget.sectionId]: {
          ...prev[cropTarget.sectionId],
          image: canvas.toDataURL('image/png', 1.0)
        }
      }));

      setCropTarget(null);
    };
    img.src = cropTarget.imageSrc;
  };

  // --- EXPORT TO IMAGE (CANVAS DRAWING) ---
  const handleExport = () => {
    setIsExporting(true);

    const width = 1500;
    const height = 2000;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      alert('Could not initialize canvas context');
      setIsExporting(false);
      return;
    }

    const sectionHeight = height / 3;

    const drawProcess = async () => {
      // 1. Draw Section Backgrounds
      ctx.fillStyle = sections.art.defaultBgColor;
      ctx.fillRect(0, 0, width, sectionHeight);

      ctx.fillStyle = sections.artist.defaultBgColor;
      ctx.fillRect(0, sectionHeight, width, sectionHeight);

      ctx.fillStyle = sections.tools.defaultBgColor;
      ctx.fillRect(0, sectionHeight * 2, width, sectionHeight);

      // 2. Draw Images in each section
      const drawSectionImage = (sec, index) => {
        return new Promise((resolve) => {
          if (!sec.image) {
            resolve();
            return;
          }

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            ctx.drawImage(img, 0, index * sectionHeight, width, sectionHeight);

            // Subtle vignette/overlay
            ctx.fillStyle = sec.id === 'tools' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, index * sectionHeight, width, sectionHeight);

            ctx.restore();
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load image for section: ${sec.id}`);
            resolve();
          };
          img.src = sec.image;
        });
      };

      await drawSectionImage(sections.art, 0);
      await drawSectionImage(sections.artist, 1);
      await drawSectionImage(sections.tools, 2);

      // 3. Draw Section Text (ONLY if no image is uploaded)
      const drawSectionText = (sec, index) => {
        if (sec.image) return; // Hide text if image is uploaded

        ctx.save();
        ctx.font = '900 135px "Outfit", system-ui, sans-serif';
        ctx.fillStyle = sec.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = sec.id === 'tools' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        const x = width / 2;
        const y = (index * sectionHeight) + (sectionHeight / 2);

        ctx.fillText(sec.name, x, y);
        ctx.restore();
      };

      drawSectionText(sections.art, 0);
      drawSectionText(sections.artist, 1);
      drawSectionText(sections.tools, 2);

      // 4. Draw Watermark "ArtArtist.in"
      ctx.save();
      const watermarkSize = 48;
      ctx.font = `900 ${watermarkSize}px "Outfit", system-ui, sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'right';

      const rightMargin = 70;
      const bottomMargin = height - 55;

      const suffixText = '.in';
      const prefixText = 'ArtArtist';
      
      const suffixWidth = ctx.measureText(suffixText).width;

      ctx.fillStyle = '#000000';
      ctx.fillText(suffixText, width - rightMargin, bottomMargin);

      ctx.fillStyle = sections.art.defaultBgColor;
      ctx.fillText(prefixText, width - rightMargin - suffixWidth, bottomMargin);

      ctx.restore();

      // 5. Trigger download
      try {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `ArtArtist_Poster_${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Failed to export image:', err);
        alert('Could not export poster. Local image files are recommended.');
      }

      setIsExporting(false);
    };

    if (document.fonts) {
      document.fonts.ready.then(() => {
        drawProcess();
      }).catch((err) => {
        console.warn('Fonts loading failed, exporting immediately:', err);
        drawProcess();
      });
    } else {
      setTimeout(drawProcess, 500);
    }
  };

  return (
    <div className="workspace-center">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
        accept="image/*"
      />

      {/* --- POSTER PREVIEW --- */}
      <div className="poster-wrapper">
        <div className="poster-border-highlight" />
        
        <div className="poster-frame">
          <div className="poster-grid">
            
            {/* ART SECTION */}
            <div 
              className={`poster-section sec-art ${!sections.art.image ? 'empty' : ''}`}
              onClick={(e) => triggerFileUpload('art', e)}
            >
              {sections.art.image && (
                <>
                  <img src={sections.art.image} alt="Art background" className="section-image" />
                  <div className="section-overlay-subtle" />
                </>
              )}
              {!sections.art.image && <div className="section-text">{sections.art.name}</div>}
            </div>

            {/* ARTIST SECTION */}
            <div 
              className={`poster-section sec-artist ${!sections.artist.image ? 'empty' : ''}`}
              onClick={(e) => triggerFileUpload('artist', e)}
            >
              {sections.artist.image && (
                <>
                  <img src={sections.artist.image} alt="Artist background" className="section-image" />
                  <div className="section-overlay-subtle" />
                </>
              )}
              {!sections.artist.image && <div className="section-text">{sections.artist.name}</div>}
            </div>

            {/* TOOLS SECTION */}
            <div 
              className={`poster-section sec-tools ${!sections.tools.image ? 'empty' : ''}`}
              onClick={(e) => triggerFileUpload('tools', e)}
            >
              {sections.tools.image && (
                <>
                  <img src={sections.tools.image} alt="Tools background" className="section-image" />
                  <div className="section-overlay-subtle" />
                </>
              )}
              {!sections.tools.image && <div className="section-text">{sections.tools.name}</div>}

              {/* Watermark Logo */}
              <div className="poster-watermark">
                <span className="watermark-red">ArtArtist</span>
                <span className="watermark-dark">.in</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- DOWNLOAD BUTTON --- */}
      <div className="actions-container">
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="download-btn-premium"
        >
          <Download size={20} />
          <span>{isExporting ? 'Generating Poster...' : 'Download Poster'}</span>
        </button>
      </div>

      <footer className="footer-credits-centered">
        ArtArtist.in Poster Studio &copy; 2026. All rights reserved.
      </footer>

      {/* --- PREMIUM CROP MODAL --- */}
      {cropTarget && (
        <div className="crop-modal-overlay">
          <div className="crop-modal">
            <div className="crop-modal-header">
              <h2>Crop Section Background</h2>
              <button className="crop-modal-close" onClick={() => setCropTarget(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="crop-modal-body">
              <img 
                src={cropTarget.imageSrc} 
                alt="Image loading helper" 
                style={{ display: 'none' }}
                onLoad={(e) => {
                  setImgSize({
                    width: e.target.naturalWidth,
                    height: e.target.naturalHeight
                  });
                }}
              />

              <div 
                className="crop-viewport"
                ref={viewportRef}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onTouchStart={handleCropTouchStart}
                onTouchMove={handleCropTouchMove}
                onTouchEnd={handleCropMouseUp}
              >
                {imgSize.width > 0 && (
                  <img 
                    src={cropTarget.imageSrc} 
                    alt="Target crop preview"
                    className="crop-image"
                    style={{
                      width: `${layout.width}px`,
                      height: `${layout.height}px`,
                      left: `${layout.left}px`,
                      top: `${layout.top}px`
                    }}
                  />
                )}
                <div className="crop-viewport-overlay">
                  <div className="crop-grid-line h-1"></div>
                  <div className="crop-grid-line h-2"></div>
                  <div className="crop-grid-line v-1"></div>
                  <div className="crop-grid-line v-2"></div>
                </div>
              </div>

              <div className="crop-tip-text">
                Drag the image above to position. Use zoom slider below.
              </div>

              <div className="crop-slider-container">
                <span className="crop-slider-label">Zoom Scale</span>
                <input 
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.02"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="slider-input"
                />
              </div>
            </div>

            <div className="crop-modal-footer">
              <button className="btn btn-secondary" onClick={() => setCropTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveCrop}>
                Crop & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
