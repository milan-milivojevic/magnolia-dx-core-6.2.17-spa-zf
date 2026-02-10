import React, { useRef } from 'react';
import { AiOutlineClose } from "react-icons/ai";
import Modal from 'react-modal';


const DownloadModal = ({ documentId, isOpen, onClose }) => {
  
  console.log("Create Modal")

  const iframeRef = useRef(null);

  const handleIframeLoad = () => {
    if (iframeRef.current) {
      // Access the iframe's document
      const iframeDocument = iframeRef.current.contentDocument;

      // Create a new style element
      const styleElement = iframeDocument.createElement('style');

      // Define your CSS styles here
      const cssStyles = `
      `;

      // Set the style element's content to your CSS styles
      styleElement.innerHTML = cssStyles;

      // Append the style element to the iframe's document head
      iframeDocument.head.appendChild(styleElement);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Create Modal"
      className="createReactModal"
    > 
      <div className='detailsModalWrapper w2p'>
        <div class="closeButtonWrapper w2p">
          <h2 className='titleId'>Download Document</h2>
          <button className="closeButton" onClick={onClose}><AiOutlineClose/></button>          
        </div>
        <div className='createModal w2p'>          
          <iframe className="createTemplateIframe"
                  ref={iframeRef}
                  title={"Template Details"}
                  src={'/DownloadDocument.do?action=view&advertInstanceId=' + documentId}
                  onLoad={handleIframeLoad}
          ></iframe>
        </div>
      </div>      
    </Modal>
  );
};

export default DownloadModal