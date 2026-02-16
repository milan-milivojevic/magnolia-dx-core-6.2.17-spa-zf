import React, { useEffect, useRef, useState } from "react";
import { IoSearchOutline } from "react-icons/io5";
import { BsFillGrid3X3GapFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";
import { querySearch, elasticSearchService } from "../../api/searchService";
import Card from "../mediaPool/helpers/Card";
import CategoriesFilter from "../mediaPool/filters/CategoriesFilter";
import FileInfoFilter from "../mediaPool/filters/FileInfoFilter";
import KeywordsFilter from "../mediaPool/filters/KeywordsFilter";
import VdbFilter from "../mediaPool/filters/VdbFilter";
import Filter1 from "../mediaPool/filters/Filter1";
import Filter2 from "../mediaPool/filters/Filter2";
import Filter3 from "../mediaPool/filters/Filter3";
import { getAPIBase } from "../../helpers/AppHelpers";
import { MdOutlineLink } from "react-icons/md";
import Button from "@mui/material/Button";
import CryptoJS from 'crypto-js';

import styled from "styled-components"

import MultiDownloadModalIframe from "../mediaPool/modals/MultiDownloadModalIframe";
import ClipLoader from "react-spinners/ClipLoader";

const Alert = styled.div`
    position: fixed;
    top: 12%;
    left: 45%;
    background-color: #0070b4;
    color: #fff;
    z-index: 9999999;
    padding: 20px;
`

function MpSearch ({
  globalQuery,
  perPage,
  perRow,
  sortOrder,
  defaultView,

  downloadButton,
  emailButton,
  detailsButton,
  copyLinkButton,
  onResetGlobalQuery
}) {

  const elementRef = useRef(null);
  const baseURL = process.env.REACT_APP_MGNL_APP_HOST; 
  console.log("baseURL: ",process.env.REACT_APP_MGNL_APP_HOST)
  const apiBase = getAPIBase();
  
  const initialSortOrder = sortOrder ? sortOrder : "uploadDate,false";
  const splitedSortOrder = initialSortOrder.split(",");
  const initialSortingType = splitedSortOrder[0];
  const initialIsAsc = splitedSortOrder[1] === "false" ? false : true;

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [sort, setSort] = useState(initialSortOrder);
  const [sortingType, setSortingType] = useState(initialSortingType);
  const [isAsc, setIsAsc] = useState(initialIsAsc);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);  
  const [matches, setMatches] = useState(0);
  const [view, setView] = useState(defaultView || "grid");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [limit, setLimit] = useState(parseInt(perPage, 10) || 25);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSuffixes, setSelectedSuffixes] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [selectedVdbs, setSelectedVdbs] = useState([]);  
  const [selectedFilter1, setSelectedFilter1] = useState([]);
  const [selectedFilter2, setSelectedFilter2] = useState([]);
  const [selectedFilter3, setSelectedFilter3] = useState([]);

  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false);

  useEffect(() => {
    
    let searchParams = new URLSearchParams(window.location.search);  
    const encryptedData = searchParams.get('data');
    

    let decryptedData = undefined;
    if (encryptedData) {
      decryptedData = decryptData(encryptedData);
     const normalized = decryptedData.replace(/[\r\n]\s*/g, '');
     searchParams = new URLSearchParams(normalized);
    }

    const urlQuery =  searchParams.get('query') || "";
    urlQuery && setQuery(urlQuery);
    const urlIsAscRaw = searchParams.get('isAsc');
    if (urlIsAscRaw !== null) {
      setIsAsc(urlIsAscRaw === 'true' || urlIsAscRaw === true);
    }
    const urlOffsetRaw = searchParams.get('offset');
    const urlOffset = urlOffsetRaw !== null ? parseInt(urlOffsetRaw, 10) : 0;
    setOffset(urlOffset);
    const urlSortingType = searchParams.get('sortingType') || sortingType;
    urlSortingType && setSortingType(urlSortingType);
    const urlLimit = parseInt(searchParams.get('limit') || perPage, 10) || 25;
    urlLimit && setLimit(urlLimit); 

    let categoriesArray = [];
    let suffixesArray = [];
    let keywordsArray = [];
    let vdbsArray = [];
    let fliter1Array = [];
    let filter2Array = [];
    let filter3Array = [];

    const categoriesString = searchParams.get('selectedCategories') || null;
    if (categoriesString && categoriesString.trim() !== '') {
      categoriesArray = categoriesString.split(',');
      setSelectedCategories(categoriesArray);
    }
    const suffixesString = searchParams.get('selectedSuffixes') || null;
    if (suffixesString && suffixesString.trim() !== '') {
      suffixesArray = suffixesString.split(',');
      setSelectedSuffixes(suffixesArray);
    } 
    const keywordsString = searchParams.get('selectedKeywords') || null;
    if (keywordsString && keywordsString.trim() !== '') {
      keywordsArray = keywordsString.split(',');
      setSelectedKeywords(keywordsArray);
    }
    const vdbsString = searchParams.get('selectedVdbs') || null;
    if (vdbsString && vdbsString.trim() !== '') {
      vdbsArray = vdbsString.split(',');
      setSelectedVdbs(vdbsArray);
    }

    const filter1String = searchParams.get('selectedFilter1') || null;
    if (filter1String && filter1String.trim() !== '') {
      fliter1Array = filter1String.split(',');
      setSelectedFilter1(fliter1Array);
    }
    const filter2String = searchParams.get('selectedFilter2') || null;
    if (filter2String && filter2String.trim() !== '') {
      filter2Array = filter2String.split(',');
      setSelectedFilter2(filter2Array);
    } 
    const filter3String = searchParams.get('selectedFilter3') || null;
    if (filter3String && filter3String.trim() !== '') {
      filter3Array = filter3String.split(',');
      setSelectedFilter3(filter3Array);
    }

   elasticSearch(urlSortingType, (urlIsAscRaw === 'true' || urlIsAscRaw === true), urlOffset, urlLimit, urlQuery, categoriesArray, suffixesArray, keywordsArray, vdbsArray, fliter1Array, filter2Array, filter3Array).then((data) => {    
      setProducts([]);
      setProducts(data);      
    });
  }, []);

  useEffect(() => {
    if (globalQuery !== null && globalQuery !== undefined) {
      setQuery(globalQuery);
      setOffset(0);
      const currentOffset = 0;
      elasticSearch(sortingType, isAsc, currentOffset, limit, globalQuery, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3).then((data) => {      
        setProducts([]);
        setProducts(data);      
      });    
    } else return;
  }, [globalQuery]);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setOffset(0);
    const currentOffset = 0;
    elasticSearch(sortingType, isAsc, currentOffset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3).then((data) => {      
      setProducts([]);
      setProducts(data);      
    });
  }, [selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3]);

  useEffect(() => {
    setSelectedAssetIds([]);
    setSelectAllChecked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    selectedCategories.join(','),
    selectedSuffixes.join(','),
    selectedKeywords.join(','),
    selectedVdbs.join(','),
    selectedFilter1.join(','),
    selectedFilter2.join(','),
    selectedFilter3.join(',')
  ]);

  const updateSelectedCategories = (selectedValues) => {
    setSelectedCategories(selectedValues);
  };

  const updateSelectedSuffixes = (selectedValues) => {
    setSelectedSuffixes(selectedValues);
  };

  const updateSelectedKeywords = (selectedValues) => {
    setSelectedKeywords(selectedValues);
  };

  const updateSelectedVdbs = (selectedValues) => {
    setSelectedVdbs(selectedValues);
  };

  const updateFilter1 = (selectedValues) => {
    setSelectedFilter1(selectedValues);
  };

  const updateFilter2 = (selectedValues) => {
    setSelectedFilter2(selectedValues);
  };

  const updateFilter3 = (selectedValues) => {
    setSelectedFilter3(selectedValues);
  };

  const elasticSearch = async (sortingType, isAsc, offset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3) => {
  
    const data = await elasticSearchService(sortingType, isAsc, offset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3);

    setProducts(data.items);
    setMatches(data.totalHits);

    const hasMoreAssets = offset < data.totalHits - 25 ? true : false;
    setHasMore(hasMoreAssets); 

    return data.items;
  };  
  
  const changeSorting = (e) => {

    setSort(e.target.value);

    const splitedSortOrder = e.target.value.split(",");
    const sortingTypeRaw = splitedSortOrder[0];
    const isAscRaw = splitedSortOrder[1] === "false" ? false : true;

    setSortingType(sortingTypeRaw);
    setIsAsc(isAscRaw);
    setOffset(0);
    const currentOffset = 0;
    

    elasticSearch(sortingTypeRaw, isAscRaw, currentOffset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3).then((data) => {      
      setProducts([]);
      setProducts(data);      
    });
  };

  const fetchMoreAssets = async (sortingType, isAsc, offset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3) => {

    const data = await elasticSearchService(sortingType, isAsc, offset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3);

    setProducts((prevProducts) => [...prevProducts, ...data.items]);
    setMatches(data.totalHits);

    const hasMoreAssets = offset < data.totalHits - 25 ? true : false;
    setHasMore(hasMoreAssets); 

    return data.items;    
  };    


  const loadMoreAssets = () => {
    const currentOffset = offset + 25;

    setOffset((prevOffset) => prevOffset + 25);

    fetchMoreAssets(sortingType, isAsc, currentOffset, limit, query, selectedCategories, selectedSuffixes, selectedKeywords, selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3);
  }

  const buttonProps = {
    downloadButton,
    emailButton,
    detailsButton,
    copyLinkButton,
  };

  const toggleGridView = () => {
    setView("grid");
  };
  const toggleListView = () => {
    setView("list");
  };  

  const encryptionKey = "XkhZG4fW2t2W";

  const encryptData = (data) => {
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      encryptionKey
    ).toString();

    return encryptedData;
  };

  const decryptData = (data) => {
    const bytes = CryptoJS.AES.decrypt(data, encryptionKey);

    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
  };

  const params = `
  query=${query}&
  sortingType=${sortingType}&
  isAsc=${isAsc}&
  offset=0&
  limit=${limit}&
  selectedCategories=${selectedCategories}&
  selectedSuffixes=${selectedSuffixes}&
  selectedKeywords=${selectedKeywords}&
  selectedVdbs=${selectedVdbs}&
  selectedFilter1=${selectedFilter1}&
  selectedFilter2=${selectedFilter2}&
  selectedFilter3=${selectedFilter3}`


  const encryptedParams = encryptData(params.replace(/[\r\n]\s*/g, ''));
  const linkPath = `${baseURL}${apiBase}/Home/Search-Pages/MP-Search?data=${encodeURIComponent(encryptedParams)}`;

  const copyLinkToSearchResult = () => {
    navigator.clipboard.writeText(linkPath)
      .then(() => {
        setShowAlert(true);
        setTimeout(() => {
          setShowAlert(false);
        }, 2500);
      })
  };

  const toggleSelectAsset = (id) => {
    setSelectedAssetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.concat(id)
    );
  };

  const fetchAllIdsForCurrentSearch = async () => {
    const batch = matches;
    let allIds = [];
    const total = matches || 0;

    setIsBulkSelecting(true);
    try {
      for (let off = 0; off < total; off += batch) {
        const data = await elasticSearchService(
          sortingType, isAsc, off, batch, query,
          selectedCategories, selectedSuffixes, selectedKeywords,
          selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3
        );
        const ids = (data.items || []).map(it => it?.fields?.id?.value).filter(Boolean);
        allIds = allIds.concat(ids);
      }
    } finally {
      setIsBulkSelecting(false);
    }
    return Array.from(new Set(allIds));
  };

  const onSelectAllChange = async (e) => {
    const checked = e.target.checked;
    setSelectAllChecked(checked);

    if (checked) {
      const ids = await fetchAllIdsForCurrentSearch();
      setSelectedAssetIds(ids);
    } else {
      setSelectedAssetIds([]);
    }
  };

  useEffect(() => {
    if (matches > 0) {
      setSelectAllChecked(selectedAssetIds.length > 0 && selectedAssetIds.length === matches);
    } else {
      setSelectAllChecked(false);
    }
  }, [selectedAssetIds, matches]);

  const resetAllFilters = () => {
    setSelectedCategories([]);
    setSelectedSuffixes([]);    
    setSelectedVdbs([]);
    setSelectedKeywords([]);
    setSelectedFilter1([]);
    setSelectedFilter2([]);
    setSelectedFilter3([]);
    setOffset(0);
    const currentOffset = 0;
    setQuery("");
    onResetGlobalQuery?.();
    setSelectedAssetIds([]);
    setSelectAllChecked(false);
    elasticSearch(sortingType, isAsc, currentOffset, limit, "", [], [], [], [], [],  [], []);
  };

  return (
    <div className="mpSearchComponent">
      <style>{`
        .filterWrapper.active .filterButton {
          background-color: #0070b4 !important;
          color: #fff !important;
        }
        .mpSearchComponent { position: relative; }
        .overlayBlocker {
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.5);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: all;
        }
      `}</style>

      {isBulkSelecting && (
        <div className="overlayBlocker" aria-busy="true" aria-label="Selecting all assets...">
          <ClipLoader color="#0070b4" />
        </div>
      )}
      {selectedAssetIds.length > 0 ? 
        (
          <div className="selectionSummary" style={{ width: '100%', padding: '0px 40px 20px 40px', display: 'flex', gap: '20px', justifyContent: 'left', alignItems: 'center' }}>
            <div className="infoDownloadSelected">{selectedAssetIds.length} {selectedAssetIds.length === 1 ?  'item' : 'items'} selected</div>
            <div>
              <button
                type="button"
                disabled={!selectedAssetIds.length || isBulkSelecting}
                onClick={() => setShowBulkDownloadModal(true)}
                className="btnDownloadSelected"
                title="Download selected"
              >
                Download
              </button>
            </div>
          </div>
        ):(
          <div className="staticSearch mpSearch">
            <div className="searchFilters">

              <div className={`filterWrapper ${selectedCategories.length ? 'active' : ''}`}>
                <CategoriesFilter
                  onUpdateSelectedCategories={updateSelectedCategories}
                  selectedCategories={selectedCategories}
                  query={query}
                  sortingType={sortingType}
                  isAsc={isAsc}
                  selectedSuffixes={selectedSuffixes}
                  selectedVdbs={selectedVdbs}
                  selectedKeywords={selectedKeywords}
                  selectedFilter1={selectedFilter1}
                  selectedFilter2={selectedFilter2}
                  selectedFilter3={selectedFilter3}
                />
              </div>

              <div className={`filterWrapper ${selectedSuffixes.length ? 'active' : ''}`}>
                <FileInfoFilter
                  onUpdateSelectedSuffixes={updateSelectedSuffixes}
                  selectedSuffixes={selectedSuffixes}
                  query={query}
                  sortingType={sortingType}
                  isAsc={isAsc}
                  selectedCategories={selectedCategories}
                  selectedVdbs={selectedVdbs}
                  selectedKeywords={selectedKeywords}
                  selectedFilter1={selectedFilter1}
                  selectedFilter2={selectedFilter2}
                  selectedFilter3={selectedFilter3}
                />
              </div>

              <div className={`filterWrapper ${selectedKeywords.length ? 'active' : ''}`}>
                <KeywordsFilter
                  onUpdateSelectedKeywords={updateSelectedKeywords}       
                  selectedKeywords={selectedKeywords}     
                  query={query}
                  sortingType={sortingType}
                  isAsc={isAsc}
                  selectedCategories={selectedCategories}
                  selectedSuffixes={selectedSuffixes}           
                  selectedVdbs={selectedVdbs}  
                  selectedFilter1={selectedFilter1}
                  selectedFilter2={selectedFilter2}
                  selectedFilter3={selectedFilter3}
                />
              </div>

              <div className={`filterWrapper ${selectedVdbs.length ? 'active' : ''}`}>
                <VdbFilter
                  onUpdateSelectedVdbs={updateSelectedVdbs}     
                  selectedVdbs={selectedVdbs}  
                />
              </div>

              <div className={`filterWrapper ${selectedFilter1.length ? 'active' : ''}`}>
                <Filter1
                  onUpdateSelectedFilter1={updateFilter1}  
                  selectedFilter1={selectedFilter1}               
                  query={query}
                  sortingType={sortingType}
                  isAsc={isAsc}
                  selectedCategories={selectedCategories}
                  selectedSuffixes={selectedSuffixes}        
                  selectedKeywords={selectedKeywords}     
                  selectedVdbs={selectedVdbs}  
                  selectedFilter2={selectedFilter2}
                  selectedFilter3={selectedFilter3}
                />
              </div>

              <div className={`filterWrapper ${selectedFilter2.length ? 'active' : ''}`}>
                <Filter2
                  onUpdateSelectedFilter2={updateFilter2}  
                  selectedFilter2={selectedFilter2}               
                  query={query}
                  sortingType={sortingType}
                  isAsc={isAsc}
                  selectedCategories={selectedCategories}
                  selectedSuffixes={selectedSuffixes}        
                  selectedKeywords={selectedKeywords}     
                  selectedVdbs={selectedVdbs}  
                  selectedFilter1={selectedFilter1}
                  selectedFilter3={selectedFilter3}
                />
              </div>

              <div className={`filterWrapper ${selectedFilter3.length ? 'active' : ''}`}>
                <Filter3
                  onUpdateSelectedFilter3={updateFilter3}  
                  selectedFilter3={selectedFilter3}               
                  query={query}
                  sortingType={sortingType}
                  isAsc={isAsc}
                  selectedCategories={selectedCategories}
                  selectedSuffixes={selectedSuffixes}        
                  selectedKeywords={selectedKeywords}     
                  selectedVdbs={selectedVdbs}  
                  selectedFilter1={selectedFilter1}
                  selectedFilter2={selectedFilter2}
                />
              </div>

              <div className="resetAllWrapper">
                <Button className="filterButton" onClick={resetAllFilters}>Reset All</Button>
              </div>
            </div>
          </div>
        )
      }
      <div className="searchActions">
        <div className="searchResult" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="matches">{matches} matches</div>
          <a className="copyLinkToResult" onClick={() => copyLinkToSearchResult()}>COPY LINK TO SEARCH RESULTS <MdOutlineLink /></a>

          <label className="downloadSelectAll" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={selectedAssetIds.length > 0}
              onChange={onSelectAllChange}
              disabled={isBulkSelecting || matches === 0}
            />
            <span>{selectedAssetIds.length > 0 ? 'Deselect all' : 'Select all'}</span>
          </label>
        </div>
        <div className="sortingView">
          <label htmlFor="sort">
            Sort by:
            <select
              name="sort"
              className="sortingOptions"
              onChange={(e) => {
                changeSorting(e);
              }}
            >
              <option value="uploadDate,false">Newest first</option>
              <option value="uploadDate,true">Oldest first</option>
              <option value="relevance,false">Most relevant first</option>
              <option value="relevance,true">Least relevant first</option>
              <option value="lastUpdatedTime,false">Last updated first</option>
              <option value="lastUpdatedTime,true">Oldest updated first</option>
              <option value="popularity,false">Most downloaded first</option>
              <option value="popularity,true">Least downloaded first</option>
              <option value="title_multi,true">Name (A-Z)</option>
              <option value="title_multi,false">Name (Z-A)</option>        
            </select>
          </label>
          <div className="viewButtons">
            <button className={`gridView ${view}`} onClick={toggleGridView}>
              <BsFillGrid3X3GapFill />
            </button>
            <button className={`listView ${view}`} onClick={toggleListView}>
              <FaThList />
            </button>
          </div>
        </div>
      </div>      

      {products && products.length > 0 ? (
        <>
          <div className={`mpSearchContainer ${view}`} style={{ gridTemplateColumns: `repeat(${perRow ? perRow : 5}, 1fr)` }}>
            {products.map(c => 
              <Card
                fields={c.fields}
                key={c.fields.id.value}
                buttonProps={buttonProps}
                onToggleSelect={toggleSelectAsset}
                isSelected={selectedAssetIds.includes(c.fields.id.value)}
              />
            )}            
          </div>
          {hasMore && (
            <div className="loadMoreItems" style={{ width: "100%" }} ref={elementRef}>
              <button type="button" onClick={() => loadMoreAssets()}>
                Load More
              </button>
            </div>
          )}
        </>
      ) : (
        <div className='mpSearchContainer'>No Results</div>
      )}

      {showBulkDownloadModal && (
        <MultiDownloadModalIframe
          isOpen={showBulkDownloadModal}
          onClose={() => setShowBulkDownloadModal(false)}
          assetIds={selectedAssetIds}
        />
      )}
      
    </div>
  );
}

export default MpSearch;
