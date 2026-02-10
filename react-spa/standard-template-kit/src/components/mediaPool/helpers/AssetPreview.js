import React, { useState, useEffect } from 'react';
import { BsChevronLeft, BsChevronRight } from "react-icons/bs";
import noImage from './no_image.jpg';

// ✅ DODATO: za public modal preview (token + fetch blob)
import { getPublicApiBearerToken } from '../../../api/searchService';

const AssetPreview = ({ assetId, assetVersion, assetPageCount, assetResourceType, isModal, usePublicAuth = false }) => {

  /* Defining state variables */
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImageStatus, setPreviewImageStatus] = useState("large");
  const [imageStatus, setImageStatus] = useState("large");

  // ✅ DODATO: secure preview (blob url) samo za MODAL + public
  const [secureSrc, setSecureSrc] = useState(null);
  const [secureFailed, setSecureFailed] = useState(false);

  const hasMultiplePages = Number(assetPageCount) > 1;
  const shouldUseSecurePreview = !!usePublicAuth; // ✅ samo u modalu, da ne ubijemo performance na grid-u

  /* Handling change of image preview based on number of asset pages */
  const handlePageChange = (nextPage) => {
    if (nextPage >= 1 && nextPage <= assetPageCount) {
      setCurrentPage(nextPage);
    }
  };

  /* Handling error when there is no image for defined size or when there is no image at all */
  const handleImageError = (e) => {
    if (imageStatus === "large") {
      e.target.src = `/rest/mp/v1.0/previews/middle/asset/${assetId}/version/${assetVersion}`;
      setImageStatus("middle");
    } else if (imageStatus === "middle") {
      e.target.src = noImage;
      setImageStatus("failed");
    }
  };

  /* Handling error when there is no image for defined size or when there is no image at all, for assets with multiple pages */
  const handlePageImageError = (e) => {
    if (previewImageStatus === "large") {
      e.target.src = `/rest/mp/v1.0/previews/middle/asset/${assetId}/version/${assetVersion}/watermark/false/page/${currentPage}`;
      setPreviewImageStatus("middle");
    } else if (previewImageStatus === "middle") {
      e.target.src = noImage;
      setPreviewImageStatus("failed");
    }
  };

  // ✅ DODATO: secure preview fetch (Authorization header + credentials omit)
  useEffect(() => {
    if (!shouldUseSecurePreview) {
      setSecureSrc(null);
      setSecureFailed(false);
      return;
    }

    let cancelled = false;
    let objectUrl = null;

    const fetchAsBlobUrl = async (url, accessToken) => {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${accessToken}`
        },
        credentials: "omit",   // 🔴 KRITIČNO: nema cookie-a => nema globalnog login-a
        cache: "no-store"
      });

      if (!res.ok) return null;

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    };

    const load = async () => {
      setSecureFailed(false);
      setSecureSrc(null);

      const tokenDto = await getPublicApiBearerToken();
      const accessToken = tokenDto && tokenDto.access_token;

      if (!accessToken) {
        setSecureFailed(true);
        return;
      }

      // Video preview (modal)
      if (assetResourceType === 'Video' && isModal) {
        const videoUrl = `/rest/mp/v1.0/previews/video/asset/${assetId}`;

        const u = await fetchAsBlobUrl(videoUrl, accessToken);
        if (cancelled) {
          if (u) URL.revokeObjectURL(u);
          return;
        }

        if (u) {
          objectUrl = u;
          setSecureSrc(u);
        } else {
          setSecureFailed(true);
        }
        return;
      }

      // Image preview
      const largeUrl = (hasMultiplePages && isModal)
        ? `/rest/mp/v1.0/previews/large/asset/${assetId}/version/${assetVersion}/watermark/false/page/${currentPage}`
        : `/rest/mp/v1.0/previews/large/asset/${assetId}/version/${assetVersion}`;

      const middleUrl = (hasMultiplePages && isModal)
        ? `/rest/mp/v1.0/previews/middle/asset/${assetId}/version/${assetVersion}/watermark/false/page/${currentPage}`
        : `/rest/mp/v1.0/previews/middle/asset/${assetId}/version/${assetVersion}`;

      // probaj large, pa fallback na middle
      let u = await fetchAsBlobUrl(largeUrl, accessToken);
      if (!u) u = await fetchAsBlobUrl(middleUrl, accessToken);

      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }

      if (u) {
        objectUrl = u;
        setSecureSrc(u);
      } else {
        setSecureFailed(true);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    shouldUseSecurePreview,
    assetId,
    assetVersion,
    assetResourceType,
    isModal,
    hasMultiplePages,
    currentPage
  ]);

  const renderContent = () => {
    // ✅ SECURE modal preview (public)
    if (shouldUseSecurePreview) {
      if (assetResourceType === 'Video' && isModal) {
        if (!secureSrc) {
          return (
            <div className='assetImageWrapper'>
              <img className="assetImage" src={noImage} alt="Preview" />
            </div>
          );
        }
        return (
          <div className="assetVideoWrapper">
            <video className="assetVideo" controls autoPlay muted>
              <source src={secureSrc} type="video/mp4" />
            </video>
          </div>
        );
      }

      // images
      if (hasMultiplePages && isModal) {
        return (
          <div className='assetImageWrapper'>
            <div className="assetImageWithNavigation">
              <img
                src={secureSrc || noImage}
                alt={`Page ${currentPage}`}
              />
              <div className="assetImagePages">
                <button className="prev" onClick={() => handlePageChange(currentPage - 1)}>
                  <BsChevronLeft />
                </button>
                <span className="pagingStatus">
                  <span className="currentPage">{currentPage}</span> of {assetPageCount}
                </span>
                <button className="next" onClick={() => handlePageChange(currentPage + 1)}>
                  <BsChevronRight />
                </button>
              </div>
            </div>
            {secureFailed && (
              <div style={{ paddingTop: 8, fontSize: 12, opacity: 0.8 }}>
                Preview not available (401).
              </div>
            )}
          </div>
        );
      }

      return (
        <div className='assetImageWrapper'>
          <img
            className="assetImage"
            src={secureSrc || noImage}
            alt="Preview"
          />
          {secureFailed && (
            <div style={{ paddingTop: 8, fontSize: 12, opacity: 0.8 }}>
              Preview not available (401).
            </div>
          )}
        </div>
      );
    }

    // ✅ ORIGINAL BEHAVIOR (non-public ili ne-modal)
    if (assetResourceType === 'Video' && isModal) {
      return (
        <div className="assetVideoWrapper">
          <video className="assetVideo" controls autoPlay muted>
            <source
              src={`/rest/mp/v1.0/previews/video/asset/${assetId}`}
              type="video/mp4"
            />
          </video>
        </div>
      );
    } else {
      return (
        <div className='assetImageWrapper'>
          {assetPageCount > 1 && isModal ? (
            <div className="assetImageWithNavigation">
              <img
                onError={handlePageImageError}
                src={`/rest/mp/v1.0/previews/large/asset/${assetId}/version/${assetVersion}/watermark/false/page/${currentPage}`}
                alt={`Page ${currentPage}`}
              />
              <div className="assetImagePages">
                <button className="prev" onClick={() => handlePageChange(currentPage - 1)}>
                  <BsChevronLeft />
                </button>
                <span className="pagingStatus">
                  <span className="currentPage">{currentPage}</span> of {assetPageCount}
                </span>
                <button className="next" onClick={() => handlePageChange(currentPage + 1)}>
                  <BsChevronRight />
                </button>
              </div>
            </div>
          ) : (
            <img
              onError={handleImageError}
              className="assetImage"
              src={`/rest/mp/v1.0/previews/large/asset/${assetId}/version/${assetVersion}`}
              alt="Preview"
            />
          )}
        </div>
      );
    }
  };

  return <div className='assetPreview'>{renderContent()}</div>;
};

export default AssetPreview;
