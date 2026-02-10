// MpWidgetsSearch.js
// ✅ Izmene:
// - Dodata CSS regula koja boji dugme filtera kada je aktivan
// - Svaki filter umotan u .filterWrapper sa uslovnom klasom 'active' na osnovu selekcije

import React, { useEffect, useState } from 'react';
import "../../styles/mediaPool/slick-theme.css";
import "../../styles/mediaPool/slick.css";
import { elasticSearchService } from '../../api/searchService';
import Card from './helpers/Card';
import CryptoJS from 'crypto-js';
import { IoSearchOutline } from "react-icons/io5";
import Button from "@mui/material/Button";

import CategoriesFilter from "../mediaPool/filters/CategoriesFilter";
import FileInfoFilter from "../mediaPool/filters/FileInfoFilter";
import KeywordsFilter from "../mediaPool/filters/KeywordsFilter";
import VdbFilter from "../mediaPool/filters/VdbFilter";
import Filter1 from "../mediaPool/filters/Filter1";
import Filter2 from "../mediaPool/filters/Filter2";
import Filter3 from "../mediaPool/filters/Filter3";

function MpWidgetsSearch({
  linkToSearchResult,
  cardsLimit,
  perRow,
  sortOrder,
  defaultView,
  widgets = {},
  downloadButton,
  emailButton,
  detailsButton,
  copyLinkButton,
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
  const initialSortOrder = sortOrder ? sortOrder : "uploadDate,false";
  const splitedSortOrder = initialSortOrder.split(",");
  const initialSortingType = splitedSortOrder[0];
  const initialIsAsc = splitedSortOrder[1] === "false" ? false : true;

  const [products, setProducts] = useState([]);
  const [matches, setMatches] = useState(0);
  const [view] = useState(defaultView || "grid");

  const [query, setQuery] = useState("");
  const [sortingType, setSortingType] = useState(initialSortingType);
  const [isAsc, setIsAsc] = useState(initialIsAsc);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(cardsLimit ? parseInt(cardsLimit, 10) : 5);
  const [hasMore, setHasMore] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSuffixes, setSelectedSuffixes] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [selectedVdbs, setSelectedVdbs] = useState([]);
  const [selectedFilter1, setSelectedFilter1] = useState([]);
  const [selectedFilter2, setSelectedFilter2] = useState([]);
  const [selectedFilter3, setSelectedFilter3] = useState([]);

  const toBool = (v, def = true) => (v === true || v === 'true' || (v === undefined ? def : v === true));

  const showThemesFilter   = toBool(widgets?.themesFilter, true);
  const showFileInfoFilter = toBool(widgets?.fileInfoFilter, true);
  const showKeywordsFilter = toBool(widgets?.keywordsFilter, true);
  const showVdbFilter      = toBool(widgets?.vdbFilter, true);
  const showFilter1        = toBool(widgets?.categoriesFilter, true);
  const showFilter2        = toBool(widgets?.assetTypeFilter, true);
  const showFilter3        = toBool(widgets?.assetGroupFilter, true);

  const getParam = (sp, key) => {
    const v = sp.get(key);
    return (v === null ? "" : v);
  };
  const splitList = (raw) =>
    (raw || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

  const sanitizeLongIds = (arr) => arr.filter(v => /^\d+$/.test(v));
  const sanitizeTextList = (arr) => arr.filter(Boolean);

  const encryptionKey = "XkhZG4fW2t2W";

  const decryptData = (data) => {
    const bytes = CryptoJS.AES.decrypt(data, encryptionKey);
    const raw = bytes.toString(CryptoJS.enc.Utf8);
    try {
      return JSON.parse(raw);
    } catch {
      return raw.replace(/^"+|"+$/g, "");
    }
  };

  const runElasticSearch = async (
    sortingTypeArg, isAscArg, offsetArg, limitArg, queryArg,
    selectedCategoriesArg, selectedSuffixesArg, selectedKeywordsArg,
    selectedVdbsArg, selectedFilter1Arg, selectedFilter2Arg, selectedFilter3Arg
  ) => {
    const data = await elasticSearchService(
      sortingTypeArg, isAscArg, offsetArg, limitArg, queryArg,
      selectedCategoriesArg, selectedSuffixesArg, selectedKeywordsArg,
      selectedVdbsArg, selectedFilter1Arg, selectedFilter2Arg, selectedFilter3Arg
    );
    setMatches(data.totalHits || 0);
    const total = data.totalHits || 0;
    const nextHasMore = offsetArg < (total - limitArg);
    setHasMore(nextHasMore);
    return data.items || [];
  };

  const initialLoad = async (
    sortingTypeArg, isAscArg, queryArg,
    cats, suff, kw, vdb, f1, f2, f3, limitArg
  ) => {
    const offsetArg = 0;
    setOffset(0);
    const items = await runElasticSearch(
      sortingTypeArg, isAscArg, offsetArg, limitArg, queryArg,
      cats, suff, kw, vdb, f1, f2, f3
    );
    setProducts(items);
  };

  const loadMore = async () => {
    const nextOffset = offset + limit;
    setOffset(nextOffset);
    const more = await runElasticSearch(
      sortingType, isAsc, nextOffset, limit, query,
      selectedCategories, selectedSuffixes, selectedKeywords,
      selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3
    );
    setProducts(prev => prev.concat(more));
  };

  const doTextSearch = () => {
    const effectiveLimit = cardsLimit ? Math.min(parseInt(cardsLimit, 10), 60) : limit;
    initialLoad(
      sortingType, isAsc, query,
      selectedCategories, selectedSuffixes, selectedKeywords,
      selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3,
      effectiveLimit
    );
  };

  const resetAllFilters = () => {
    setSelectedCategories([]);
    setSelectedSuffixes([]);
    setSelectedVdbs([]);
    setSelectedKeywords([]);
    setSelectedFilter1([]);
    setSelectedFilter2([]);
    setSelectedFilter3([]);
    setOffset(0);
    setQuery("");
    const effectiveLimit = cardsLimit ? Math.min(parseInt(cardsLimit, 10), 60) : limit;
    initialLoad(
      sortingType, isAsc, "",
      [], [], [], [], [], [], [],
      effectiveLimit
    );
  };

  useEffect(() => {
    if (!linkToSearchResult) {
      const effectiveLimit = cardsLimit ? Math.min(parseInt(cardsLimit, 10), 60) : 5;
      setLimit(effectiveLimit);
      initialLoad(
        sortingType, isAsc, "",
        [], [], [], [], [], [], [],
        effectiveLimit
      );
      return;
    }
    try {
      const url = new URL(linkToSearchResult);
      const sp = new URLSearchParams(url.search);
      const encryptedData = sp.get("data");
      let paramsString = "";
      if (encryptedData) {
        const decrypted = decryptData(encryptedData);
        const normalized = decrypted.replace(/[\r\n]\s*/g, "");
        paramsString = normalized;
      } else {
        paramsString = sp.toString();
      }
      const params = new URLSearchParams(paramsString);

      const q = getParam(params, "query");
      setQuery(q);

      const sortingTypeFromLink = getParam(params, "sortingType");
      const isAscFromLinkRaw = getParam(params, "isAsc");
      const isAscFromLink = (isAscFromLinkRaw === "true" || isAscFromLinkRaw === true);

      if (sortOrder) {
        const so = sortOrder.split(",");
        const st = so[0];
        const asc = so[1] === "false" ? false : true;
        setSortingType(st);
        setIsAsc(asc);
      } else {
        setSortingType(sortingTypeFromLink || initialSortingType);
        setIsAsc(isAscFromLinkRaw ? isAscFromLink : initialIsAsc);
      }

      const limitRaw = getParam(params, "limit");
      const linkLimit = limitRaw ? parseInt(limitRaw, 10) : 5;
      const effectiveLimit = cardsLimit ? Math.min(parseInt(cardsLimit, 10), 60) : Math.min(linkLimit, 60);
      setLimit(effectiveLimit);

      const cats = sanitizeLongIds(splitList(getParam(params, "selectedCategories")));
      const suff = sanitizeTextList(splitList(getParam(params, "selectedSuffixes")));
      const kw   = sanitizeLongIds(splitList(getParam(params, "selectedKeywords")));
      const vdb  = sanitizeLongIds(splitList(getParam(params, "selectedVdbs")));
      const f1   = sanitizeLongIds(splitList(getParam(params, "selectedFilter1")));
      const f2   = sanitizeLongIds(splitList(getParam(params, "selectedFilter2")));
      const f3   = sanitizeLongIds(splitList(getParam(params, "selectedFilter3")));

      setSelectedCategories(cats);
      setSelectedSuffixes(suff);
      setSelectedKeywords(kw);
      setSelectedVdbs(vdb);
      setSelectedFilter1(f1);
      setSelectedFilter2(f2);
      setSelectedFilter3(f3);

      const finalSortingType = sortOrder ? sortOrder.split(",")[0] : (sortingTypeFromLink || initialSortingType);
      const finalIsAsc       = sortOrder ? (sortOrder.split(",")[1] === "false" ? false : true) : (isAscFromLinkRaw ? isAscFromLink : initialIsAsc);

      initialLoad(
        finalSortingType, finalIsAsc, q,
        cats, suff, kw, vdb, f1, f2, f3,
        effectiveLimit
      );

    } catch (e) {
      console.error("MpWidgetsSearch – parse link error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToSearchResult, sortOrder, cardsLimit, defaultView, perRow]);

  useEffect(() => {
    const effectiveLimit = cardsLimit ? Math.min(parseInt(cardsLimit, 10), 60) : limit;
    initialLoad(
      sortingType, isAsc, query,
      selectedCategories, selectedSuffixes, selectedKeywords,
      selectedVdbs, selectedFilter1, selectedFilter2, selectedFilter3,
      effectiveLimit
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCategories.join(","),
    selectedSuffixes.join(","),
    selectedKeywords.join(","),
    selectedVdbs.join(","),
    selectedFilter1.join(","),
    selectedFilter2.join(","),
    selectedFilter3.join(",")
  ]);

  const updateSelectedCategories = (vals) => setSelectedCategories(vals);
  const updateSelectedSuffixes   = (vals) => setSelectedSuffixes(vals);
  const updateSelectedKeywords   = (vals) => setSelectedKeywords(vals);
  const updateSelectedVdbs       = (vals) => setSelectedVdbs(vals);
  const updateFilter1            = (vals) => setSelectedFilter1(vals);
  const updateFilter2            = (vals) => setSelectedFilter2(vals);
  const updateFilter3            = (vals) => setSelectedFilter3(vals);

  const buttonProps = { downloadButton, emailButton, detailsButton, copyLinkButton };

  const TitleLevel = titleLevel || "h1";
  const titleStyles = {
    fontFamily: titleFontFamily || null,
    textAlign:  titlePosition || null,
    fontSize:   titleFontSize || null,
    color:      titleColor || null,
    paddingTop: titlePaddingTop || null,
    paddingRight: titlePaddingRight || null,
    paddingBottom: titlePaddingBottom || null,
    paddingLeft: titlePaddingLeft || null
  };

  return (
    <div className='mpSearchComponent widgetSearch' id={navigationId && navigationId}>
      {/* ✅ DODATO: lokalna CSS pravila za aktivne filter dugmiće */}
      <style>{`
        .filterWrapper.active .filterButton {
          background-color: #0070b4 !important;
          color: #fff !important;
        }
      `}</style>

      {title &&
        <TitleLevel className="title" style={titleStyles}>
          {title}
        </TitleLevel>
      }

      <div className="staticSearch mpSearch">
        <div className="searchFilters">
          <div className='flex textFilter'>
            <input
              type='text'
              className='searchInput'
              placeholder='Search...'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doTextSearch()}
            />
            <button type='button' onClick={doTextSearch} title="Search">
              <IoSearchOutline />
            </button>
          </div>

          {showThemesFilter && (
            // ✅ DODATO: wrapper sa aktivnom klasom
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
          )}

          {showFileInfoFilter && (
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
          )}

          {showKeywordsFilter && (
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
          )}

          {showVdbFilter && (
            <div className={`filterWrapper ${selectedVdbs.length ? 'active' : ''}`}>
              <VdbFilter
                onUpdateSelectedVdbs={updateSelectedVdbs}
                selectedVdbs={selectedVdbs}
              />
            </div>
          )}

          {showFilter1 && (
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
          )}

          {showFilter2 && (
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
          )}

          {showFilter3 && (
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
          )}

          <div className="resetAllWrapper">
            <Button className="filterButton" onClick={resetAllFilters}>Reset All</Button>
          </div>
        </div>
      </div>

      {products && products.length > 0 ? (
        <>
          <div
            className={`mpSearchContainer ${view}`}
            style={{ gridTemplateColumns: `repeat(${perRow ? perRow : 5}, 1fr)` }}
          >
            {products.map(c =>
              <Card
                fields={c.fields}
                key={c.fields.id.value}
                buttonProps={buttonProps}
              />
            )}
          </div>
          {hasMore && (
            <div className="loadMoreItems" style={{ width: "100%" }}>
              <button type="button" onClick={loadMore}>Load More</button>
            </div>
          )}
        </>
      ) : (
        <div className='mpSearchContainer'>No Results</div>
      )}
    </div>
  );
}

export default MpWidgetsSearch;
