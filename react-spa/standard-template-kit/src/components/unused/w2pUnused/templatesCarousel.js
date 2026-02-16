import React, { useState, useEffect } from 'react';
import Slider from 'react-slick';
import "../../styles/mediaPool/slick-theme.css"
import "../../styles/mediaPool/slick.css"
import { customSearch, idSearch } from '../../../api/searchService'
import Card from '../../search/Card';

function TemplatesCarousel({ 
  assetsIds, 
  requestPayload, 
  sortOrder,

  downloadButton,
  emailButton,
  detailsButton,
  copyLinkButton,

  slidesToShow, 
  slidesToScroll, 
  showDots, 
  infinite,
  autoplay,

  assetTitle,
  titleLevel,
  titlePosition,
  titleFontFamily,
  titleColor,
  titleFontSize,
  titlePaddingTop,
  titlePaddingBottom,
  titlePaddingLeft,
  titlePaddingRight
}) {

  const [products, setProducts] = useState([]);
  
  const settings = {
    
    slidesToShow: slidesToShow || 5,
    slidesToScroll: slidesToScroll || 1,
    speed: 500,
    infinite: false,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  const assetIdsArray = [];

  for (const key in assetsIds) {
    if (key.startsWith('assetsIds')) {
      assetIdsArray.push(assetsIds[key].assetId);
    }
  }

  console.log("assetIdsArray");
  console.log(assetIdsArray);

  const limit = 20 - assetIdsArray?.length;
  const spitedSortOrder = sortOrder?.split(',') || "lastUpdatedTime, false";
  const sortingType = spitedSortOrder[0];
  const isAsc = spitedSortOrder[1] === "false" ? false : true;
  const offset = 0;
  const payload = requestPayload && JSON.parse(requestPayload);
  
  const customPayloadSearch = async () => {
    const res = await customSearch(payload, sortingType, isAsc, offset, limit);
    setProducts((prevProducts) => prevProducts.concat(res.items));
    console.log("[searchById res.items]");
    console.log(res.items);
    console.log("----------------------");
  }

  const fetchData = async () => {
    try {
      const assetsData = await Promise.all(assetIdsArray.map(async (assetId) => {
        const res = await idSearch(assetId);
        return res.items;
      }));
      console.log("assetsData");
      console.log(assetsData);
      const flattenedAssets = assetsData.flat();
      console.log("flattenedAssets");
      console.log(flattenedAssets);
      setProducts(flattenedAssets);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    console.log("1products");
    console.log(products);
    requestPayload && customPayloadSearch();
    console.log("2products");    
    console.log(products);
  }, []);

  return (
    <div className='mpCarouselWrapper'>
      <Slider {...settings}>
        {products?.map((c) => (
          <div key={c.fields.id.value}>
            <Card fields={c.fields} />
          </div>
        ))}
      </Slider>
    </div>
  );
}

export default TemplatesCarousel;
