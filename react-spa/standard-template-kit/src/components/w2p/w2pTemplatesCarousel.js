import React, { useState, useEffect, useRef } from 'react';
import Slider from 'react-slick';
import "../../styles/mediaPool/slick-theme.css"
import "../../styles/mediaPool/slick.css"
import { idSearch, templatesSearchService, newTemplates, recentlyUsedTemplates, favouriteTemplates } from '../../api/w2pSearchService'
import Card from './helpers/Card';
import CryptoJS from 'crypto-js';

function W2PTemplatesCarousel({ 
  templateIds, 
  linkToSearchResult, 

  templatesSearchType,
  sortOrderTemplates,
  cardsLimit,

  detailsButton,
  favouritesButton,
  createDocumentButton,  
  copyLinkButton,

  slidesToShow, 
  slidesToScroll, 
  showDots, 
  loop,
  autoplay,

  title,
  titleLevel,
  titlePosition,
  titleFontFamily,
  titleColor,
  titleFontSize,
  titlePaddingTop,
  titlePaddingBottom,
  titlePaddingLeft,
  titlePaddingRight,
  navigationId
}) {

  const initialSortOrder = sortOrderTemplates ? sortOrderTemplates : "creationDate,desc";
  const splitedSortOrder = initialSortOrder.split(',');
  const initialSortType = splitedSortOrder[0];
  const initialSortDirection = splitedSortOrder[1] === "asc" ? "asc" : "desc";

  const sliderRef = useRef(null);
  const [products, setProducts] = useState([]);
  
  const settings = {
    
    slidesToShow: slidesToShow || 5, 
    slidesToScroll: slidesToScroll || 1,
    speed: 500,
    autoplay: autoplay === "false" ? false : true,
    infinite: loop === "false" ? false : true,
    dots: showDots === "false" ? false : true,
    initialSlide: 0,
    responsive: [
      {
        breakpoint: 1440,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 1, 
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1, 
        },
      },
    ],
    onInit: () => {
        resetTransform();
    },
  };

  const resetTransform = () => {
    var interval = setInterval(() => {
      
      const slickList = sliderRef.current.innerSlider.list;
      if (slickList) {
        const slickTrack = slickList.querySelector('.slick-track');
        if (slickTrack) {
          slickTrack.style.transform = 'translate3d(0px, 0px, 0px)';
        }
      }
    }, 500);
    setTimeout(function( ) { clearInterval( interval ); }, 3000);
  };

  const templatesIdsArray = [];

  for (const key in templateIds) {
    if (key.startsWith('templateIds')) {
      templatesIdsArray.push(templateIds[key].templateId);
    }
  }

  const size = cardsLimit ? cardsLimit > 40 ? 40 : cardsLimit : 20;
  const calculatedSize = size - templatesIdsArray?.length;  

  const templatesSearch = async () => {

    let url = new URL(linkToSearchResult);
    let searchParams = new URLSearchParams(url.search);  
    const encryptedData = searchParams.get('data');

    let decryptedData = undefined;
    if (encryptedData) {
      decryptedData = decryptData(encryptedData);
      searchParams = new URLSearchParams(decryptedData)
    }

    const query = searchParams.get('query') || "";
    const sortDirection = searchParams.get('sortDirection') || initialSortDirection;
    const sortType = searchParams.get('sortType') || initialSortType;
    const customSize = searchParams.get('size') || size;
    const calcCustomSize = customSize > 40 ? 40 : customSize - templatesIdsArray?.length;
    const offset = searchParams.get('offset') || 0;

    const selectedTemplateType = searchParams.get('selectedTemplateType') || null;
    const selectedDetails = searchParams.get('selectedDetails') || null;
    const selectedTemlateStatus = searchParams.get('selectedTemlateStatus') || null;

    const data = await templatesSearchService(query, sortType, sortDirection, calcCustomSize, offset, selectedTemplateType, selectedDetails, selectedTemlateStatus);
    setProducts((prevProducts) => prevProducts.concat(data.rows));
  }

  const encryptionKey = "XkhZG4fW2t2W";

  const decryptData = (data) => {
    const bytes = CryptoJS.AES.decrypt(data, encryptionKey);

    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
  };

  const getFavouriteTemplates = async () => {
    const response = await favouriteTemplates();
    setProducts([]);
    setProducts(response.rows);
  }

  const getRecentlyUsedTemplates = async () => {
    const response = await recentlyUsedTemplates();
    setProducts([]);
    setProducts(response.rows);
  }

  const getNewTemplates = async () => {
    const response = await newTemplates();
    setProducts([]);
    setProducts(response.rows);
  }

  const idsSearch = async () => {
    try {
      const templatesData = await Promise.all(templatesIdsArray.map(async (templateId) => {
        const response = await idSearch(templateId);
        return response.rows;
      }));
      const flattenedData = templatesData.flat();
      setProducts(flattenedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    templateIds && (!templatesSearchType || (templatesSearchType !== "favorites" && templatesSearchType !== "used" && templatesSearchType !== "new")) && idsSearch();
    linkToSearchResult && templatesSearchType && templatesSearchType === "searchLink" && templatesSearch();
    templatesSearchType && templatesSearchType === "favorites" && getFavouriteTemplates(calculatedSize);
    templatesSearchType && templatesSearchType === "used" && getRecentlyUsedTemplates(calculatedSize);
    templatesSearchType && templatesSearchType === "new" && getNewTemplates(calculatedSize);
  }, []);

  const buttonProps = {
    detailsButton,
    favouritesButton,
    createDocumentButton,
    copyLinkButton,
  };

  const TitleLevel = titleLevel || "h1";

  const titleStyles = {
    fontFamily: titleFontFamily || null,
    textAlign:  titlePosition || null,
    fontSize: titleFontSize || null,
    color: titleColor || null,
    paddingTop: titlePaddingTop || null,
    paddingRight: titlePaddingRight || null,
    paddingBottom: titlePaddingBottom || null,
    paddingLeft: titlePaddingLeft || null
  } 

  return (
    <div className='mpCarouselWrapper' id={navigationId && navigationId}>
      {title &&
        <TitleLevel className="title" style={titleStyles}>
          {title}
        </TitleLevel>
      }
      {products && products.length > 0 ? (
          <Slider ref={sliderRef} {...settings}>
            {products.map(c => 
              <Card
                templateData={c}
                key={c.id}
                buttonProps={buttonProps}
              />
            )}
          </Slider>
        ) : (
          <div className='noResults'>No Results</div>
      )}
    </div>
  );
}

export default W2PTemplatesCarousel;