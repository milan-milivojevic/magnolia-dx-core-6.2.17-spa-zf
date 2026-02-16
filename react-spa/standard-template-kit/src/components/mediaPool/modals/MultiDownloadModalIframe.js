import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import { AiOutlineClose } from "react-icons/ai";
import ClipLoader from "react-spinners/ClipLoader";

const MultiDownloadModalIframe = ({ assetIds = [], isOpen, onClose }) => {
  const viewIframeRef = useRef(null);
  const postIframeName = useRef(`multiDlPostFrame_${Math.random().toString(36).slice(2)}`);
  const cancelRef = useRef(false);
  const eligibleRef = useRef([]);
  const mutationObsRef = useRef(null);

  const [opKey, setOpKey] = useState('');
  const [schemeId, setSchemeId] = useState('5');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const [downloadDisabledByLicense, setDownloadDisabledByLicense] = useState(false);
  const [eligibleCount, setEligibleCount] = useState(0);

  const src = useMemo(() => {
    const qs = (assetIds || [])
      .filter(Boolean)
      .map(id => `downloadMedia(${id}).mediaGUID=${encodeURIComponent(id)}`)
      .join('&');
    return `/MediapoolDownloadMedias.do?${qs}`;
  }, [assetIds]);

  useEffect(() => {
    if (!isOpen) {
      setBusy(false);
      setPhase('');
      setProgress('');
      setError('');
      cancelRef.current = true;
      setEligibleCount(0);
      setDownloadDisabledByLicense(false);
      eligibleRef.current = [];
      try {
        mutationObsRef.current?.disconnect?.();
      } catch {}
      mutationObsRef.current = null;
    } else {
      cancelRef.current = false;
    }
  }, [isOpen]);

  const getIframeDoc = useCallback(() => {
    return viewIframeRef.current?.contentDocument || viewIframeRef.current?.contentWindow?.document || null;
  }, []);
  const getIframeWin = useCallback(() => {
    return viewIframeRef.current?.contentWindow || null;
  }, []);

  const tryReadCtxFromIframe = useCallback(() => {
    try {
      const doc = getIframeDoc();
      if (!doc) return;
      const key = doc.querySelector('input[name="operationKey"]')?.value;
      const sch = doc.querySelector('#downloadSchemeId')?.value
        || doc.querySelector('input[name="downloadSchemeId"]')?.value;
      if (key) setOpKey(key);
      if (sch) setSchemeId(sch);
    } catch {
    }
  }, [getIframeDoc]);

  const getActiveMediaFromIframe = useCallback(() => {
    try {
      const win = getIframeWin();
      const listObj = win?.DownloadSelection?.getActiveMediaObjects?.();
      const arr = Array.isArray(listObj?.mediaObjects) ? listObj.mediaObjects : [];
      return arr
        .filter(m => m && (m.mediaGUID != null))
        .map(m => ({
          mediaGUID: String(m.mediaGUID),
          mediaVersion: (m.mediaVersion != null ? String(m.mediaVersion) : '0'),
        }));
    } catch {
      return [];
    }
  }, [getIframeWin]);

  const readLicenseState = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return { allRequireLicense: false, anyLicenseChecked: false, licenseAssetGuids: new Set() };
    try {
      const cbs = Array.from(doc.querySelectorAll('input.licenseFragmentItemCheckboxSelector'));
      const licenseAssetGuids = new Set(
        cbs
          .map(cb => {
            const m = cb.id && cb.id.match(/^licenseAgree_(\d+)_/i);
            return m ? m[1] : null;
          })
          .filter(Boolean)
          .map(String)
      );
      const anyLicenseChecked = cbs.some(cb => cb.checked);
      const normalizedInputIds = (assetIds || []).filter(Boolean).map(String);
      const allRequireLicense =
        normalizedInputIds.length > 0 &&
        normalizedInputIds.every(id => licenseAssetGuids.has(id));
      return { allRequireLicense, anyLicenseChecked, licenseAssetGuids };
    } catch {
      return { allRequireLicense: false, anyLicenseChecked: false, licenseAssetGuids: new Set() };
    }
  }, [assetIds, getIframeDoc]);

  const recomputeEligibility = useCallback(() => {
    tryReadCtxFromIframe();
    const active = getActiveMediaFromIframe();
    eligibleRef.current = active;
    setEligibleCount(active.length);

    const { allRequireLicense, anyLicenseChecked } = readLicenseState();
    setDownloadDisabledByLicense(Boolean(allRequireLicense && !anyLicenseChecked));
  }, [getActiveMediaFromIframe, readLicenseState, tryReadCtxFromIframe]);

  const handleIframeLoad = useCallback(() => {
    tryReadCtxFromIframe();
    try {
      const doc = getIframeDoc();
      if (!doc) return;

      const styleTag = doc.createElement('style');
      styleTag.textContent = `
      `;
      doc.head.appendChild(styleTag);

      const cancelBtn = doc.getElementById('cancelButton');
      if (cancelBtn) {
        cancelBtn.onclick = null;
        cancelBtn.addEventListener('click', (e) => {
          e.preventDefault();
          onClose?.();
        });
      }

      setTimeout(() => {
        recomputeEligibility();
      }, 150);

      const changeHandler = () => recomputeEligibility();
      doc.addEventListener('change', changeHandler, true);
      doc.addEventListener('click', changeHandler, true);

      try {
        mutationObsRef.current?.disconnect?.();
        mutationObsRef.current = new MutationObserver(() => {
          setTimeout(() => recomputeEligibility(), 50);
        });
        mutationObsRef.current.observe(doc.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['checked', 'class', 'disabled', 'value'],
        });
      } catch {
        
      }

      const cleanup = () => {
        try {
          doc.removeEventListener('change', changeHandler, true);
          doc.removeEventListener('click', changeHandler, true);
        } catch {}
        try {
          mutationObsRef.current?.disconnect?.();
        } catch {}
        mutationObsRef.current = null;
      };
      const observerForClose = new MutationObserver(() => {
        if (!isOpen) cleanup();
      });
      try {
        observerForClose.observe(document.body, { attributes: true });
      } catch {}
    } catch {
      
    }
  }, [getIframeDoc, isOpen, onClose, recomputeEligibility, tryReadCtxFromIframe]);

  function parseStatusText(txt) {
    try {
      return new Function(`return (${txt});`)();
    } catch {
      return null;
    }
  }

  async function initialProbe(operationId) {
    const url = `/LoadingOperation.do?operationId=${encodeURIComponent(operationId)}&responseType=1&_dc=${Date.now()}`;
    await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).catch(() => {});
  }

  async function poll(operationId) {
    while (!cancelRef.current) {
      const res = await fetch(
        `/LoadingOperation.do?operationId=${encodeURIComponent(operationId)}&responseType=1&_dc=${Date.now()}`,
        { method: 'GET', credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
      );
      const txt = await res.text();
      const payload = parseStatusText(txt) || {};
      const status = String(payload.status ?? '');
      if (payload.progress) setProgress(String(payload.progress));
      if (status === '2' || status === '3') return payload;
      await new Promise(r => setTimeout(r, 1000));
    }
    return { status: 'cancelled' };
  }

  function submitViaHiddenForm(actionVal, operationId, scheme, ids) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/MediapoolDownloadMedias.do';
    form.target = postIframeName.current;

    const put = (name, val) => {
      const inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = name;
      inp.value = val;
      form.appendChild(inp);
    };

    put('action', actionVal);
    put('operationKey', operationId);
    put('schemeSelectionRadio', String(scheme));
    put('downloadSchemeId', String(scheme));

    (ids || []).forEach(item => {
      const isObj = item && typeof item === 'object';
      const guid = String(isObj ? (item.mediaGUID ?? item.id ?? item.guid ?? item.assetId) : item);
      const version = String(isObj ? (item.mediaVersion ?? item.version ?? 0) : 0);
      if (!guid) return;
      put(`downloadMedia(${guid}).mediaGUID`, guid);
      put(`downloadMedia(${guid}).mediaVersion`, version);
    });

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 0);
  }

  const handleDownloadClick = useCallback(async () => {
    recomputeEligibility();

    const key = opKey;
    const sch = schemeId || '5';
    if (!key) {
      alert('Nije pronađen operationKey iz iFrame-a.');
      return;
    }

    const eligible = Array.isArray(eligibleRef.current) ? eligibleRef.current : [];
    if (!eligible.length) {
      alert('Nijedan asset trenutno nije spreman za preuzimanje. Proverite da li ste selektovali/čekirali potrebne stavke i/ili prihvatili licence.');
      return;
    }

    setBusy(true);
    setPhase('preparing');
    setProgress('');
    setError('');
    cancelRef.current = false;

    try {
      await initialProbe(key);

      submitViaHiddenForm('start_download', key, sch, eligible);
      const prep = await poll(key);
      if (String(prep.status) === '3') {
        setError((Array.isArray(prep.errors) && prep.errors.join('\n')) || 'Error while zipping.');
        setBusy(false);
        setPhase('error');
        return;
      }

      setPhase('downloading');
      submitViaHiddenForm('download', key, sch, eligible);
      const fin = await poll(key);
      if (String(fin.status) === '3') {
        setError((Array.isArray(fin.errors) && fin.errors.join('\n')) || 'Error during download.');
        setBusy(false);
        setPhase('error');
        return;
      }

      setPhase('done');
      setBusy(false);
    } catch (e) {
      console.error(e);
      setError('Neočekivana greška tokom preuzimanja.');
      setBusy(false);
      setPhase('error');
    }
  }, [opKey, schemeId, recomputeEligibility]);

  const handleCancelClick = useCallback(() => {
    cancelRef.current = true;
    if (!busy) onClose?.();
  }, [busy, onClose]);

  return (
    <>
      {}
      <style>{`
        .ReactModal__Overlay.ReactModal__Overlay--after-open {
          position: fixed;
          inset: 0px;
          background-color: rgba(255, 255, 255, 0.75);
        }          
        .multiFooter {
          padding: 10px 30px 30px;
          display: flex;
          align-items: center;
          justify-content: right;
          background: #fff;
        }
        .btn-cancel, .btn-download {
          background-color: #b7bdc4;
          border-radius: 4px;
          font-family: 'Roboto', sans-serif;
          padding: 9px 16px;
          font-size: 14px;
          border: 1px solid #999;
          color: #000;
          min-width: 102px;
          cursor: pointer;
        }
        .btn-cancel:hover, .btn-download:hover {
          background-color: #d5d5d5 !important;
          color: #000 !important;
          border-color: #999 !important;
        }
        .btn-download:disabled {
          background-color: #ebebeb !important;
          color: #999 !important;
          cursor: not-allowed !important;
        }
        .btn-download span {
          margin-top: 1px;
        }
      `}</style>

      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Download Modal"
        className="detailsReactModal"
        overlayClassName="ReactModal__Overlay"
      >
        <div className="detailsModalWrapper iframe">
          <div className="closeButtonWrapper">
            <button className="closeButton" onClick={onClose} aria-label="Close">
              <AiOutlineClose />
            </button>
          </div>

          <div className="detailsModal downloadModal w2p" style={{ display: 'grid', gridTemplateRows: '1fr auto' }}>
            <iframe
              ref={viewIframeRef}
              className="detailsIframe"
              title="Assets Download"
              src={src}
              onLoad={handleIframeLoad}
            />

            {}
            <div className="multiFooter">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {}
                {}

                <button
                  onClick={handleCancelClick}
                  disabled={busy}
                  className="btn-cancel"
                  style={{                    
                    opacity: busy ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleDownloadClick}
                  disabled={busy || !assetIds?.length || downloadDisabledByLicense || eligibleCount === 0}
                  className="btn-download"
                  style={{
                    background: busy ? '#ebebeb' : '#b7bdc4',
                    display: 'flex',
                    gap: '4px',
                    opacity: busy ? 0.8 : 1
                  }}
                  title={downloadDisabledByLicense ? 'Potrebno je prihvatiti licencu za barem jedan asset.' : undefined}
                >
                  {busy ? (
                    <>
                      <ClipLoader color="#999" size={14} />
                      {phase === 'preparing'
                        ? 'Preparing...'
                        : phase === 'downloading'
                        ? 'Downloading...'
                        : 'Working...'}
                    </>
                  ) : (
                    'Download'
                  )}
                </button>
              </div>
            </div>
          </div>

          {}
          <iframe
            name={postIframeName.current}
            title="multiDlPostFrame"
            style={{ display: 'none' }}
          />
        </div>
      </Modal>
    </>
  );
};

export default MultiDownloadModalIframe;
