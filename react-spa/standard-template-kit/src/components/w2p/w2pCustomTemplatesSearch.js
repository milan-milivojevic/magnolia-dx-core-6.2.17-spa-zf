import React, { useEffect, useState } from 'react';
import { BsFillGrid3X3GapFill } from 'react-icons/bs';
import { FaThList } from 'react-icons/fa';
import { idSearch, templatesSearchService, newTemplates, recentlyUsedTemplates, favouriteTemplates } from '../../api/w2pSearchService'
import Card from './helpers/Card';
import CryptoJS from 'crypto-js';

function W2PCustomTemplatesSearch ({   
  templateIds, 
  linkToSearchResult, 

  detailsButton,
  favouritesButton,
  createDocumentButton,  
  copyLinkButton,

  templatesSearchType,
  sortOrderTemplates,
  cardsLimit,
  perRow,  
  defaultView, 

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

  const [products, setProducts] = useState([]);

  const templatesIdsArray = [];

  for (const key in templateIds) {
    if (key.startsWith('templateIds')) {
      templatesIdsArray.push(templateIds[key].templateId);
    }
  }

  const size = cardsLimit ? cardsLimit > 60 ? 60 : cardsLimit : 25;
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
    const calcCustomSize = customSize > 60 ? 60 : customSize - templatesIdsArray?.length;
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

  const getFavouriteTemplates = async (size) => {
    const response = await favouriteTemplates(size);
    setProducts([]);
    setProducts(response.rows);
  }

  const getRecentlyUsedTemplates = async (size) => {
    const response = await recentlyUsedTemplates(size);
    setProducts([]);
    setProducts(response.rows);
  }

  const getNewTemplates = async (size) => {
    const response = await newTemplates(size);
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
    <div className='mpSearchComponent' id={navigationId && navigationId}>
      {title &&
        <TitleLevel className="title" style={titleStyles}>
          {title}
        </TitleLevel>
      }
      {products && products.length > 0 ? (
          <div className={`mpSearchContainer ${defaultView}`} style={{ gridTemplateColumns: `repeat(${perRow ? perRow : 5}, 1fr)` }}>
            {products.map(c => 
              <Card
                templateData={c}
                key={c.id}
                buttonProps={buttonProps}
              />
            )}
          </div>
        ) : (
          <div className='mpSearchContainer'>No Results</div>
      )}      
    </div>
  )

}

export default W2PCustomTemplatesSearch;