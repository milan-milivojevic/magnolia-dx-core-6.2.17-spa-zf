import React, { useState, useEffect } from "react"; 
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import keywordsPayload from './payloads/keywordsPayload.json';
import { AiOutlineClose } from "react-icons/ai";
import { ClipLoader } from "react-spinners";

export default function KeywordsFilter({
  onUpdateSelectedKeywords,
  selectedKeywords,
  query = "",
  sortingType,
  isAsc,
  selectedCategories = [],
  selectedSuffixes = [],
  selectedVdbs = [],
  selectedFilter1 = [],
  selectedFilter2 = [],
  selectedFilter3 = [],
}) {

  const [parents, setParents] = useState([]);
  const [initialParents, setInitialParents] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [tempParents, setTempParents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const baseUrl = process.env.REACT_APP_MGNL_HOST;

  const injectActiveFilters = (payload) => {
    if (payload?.criteria?.subs?.[0]?.value !== undefined) {
      payload.criteria.subs[0].value = query;
    }

    if (selectedCategories?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["themes.id"],
        "long_value": selectedCategories,
        "any": true
      });
    }

    if (selectedSuffixes?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["extension"],
        "text_value": selectedSuffixes
      });
    }

    if (selectedVdbs?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["vdb.id"],
        "long_value": selectedVdbs,
        "any": true
      });
    }

    if (selectedFilter1?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["customAttribute_439.id"],
        "long_value": selectedFilter1,
        "any": true
      });
    }
    if (selectedFilter2?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["customAttribute_450.id"],
        "long_value": selectedFilter2,
        "any": true
      });
    }
    if (selectedFilter3?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["customAttribute_477.id"],
        "long_value": selectedFilter3,
        "any": true
      });
    }     
  };

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);

        const countPayload = JSON.parse(JSON.stringify(keywordsPayload));
        injectActiveFilters(countPayload);

        const countRes = await fetch(`${baseUrl}/rest/mp/v1.1/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(countPayload)
        });
        const countData = await countRes.json();

        const groups = countData?.aggregations?.keywords?.aggs?.id?.subGroups || [];
        const countsMap = new Map();
        groups.forEach(g => countsMap.set(+g.group, g.count));

        const kwRes = await fetch(`${baseUrl}/rest/mp/v1.2/keywords`);  
        const kwData = await kwRes.json();

        const mapped = kwData.items.map(item => ({
          id: item.id,
          label: item?.name?.EN || item?.name?.DE || String(item.id),
          value: String(item.id),
          count: countsMap.get(item.id) || 0,
          isChecked: selectedKeywords?.includes(String(item.id))
        }));

        const final = mapped
          .map((m, idx) => ({ ...m, __i: idx }))
          .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.__i - b.__i;
          })
          .map(({ __i, ...rest }) => rest);

        setParents(final);
        setInitialParents(final);
      } catch (e) {
        console.error('Keywords filter error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [
    query, sortingType, isAsc,
    selectedCategories.join(','),
    selectedSuffixes.join(','),
    selectedVdbs.join(','),
    selectedFilter1.join(','),
    selectedFilter2.join(','),
    selectedFilter3.join(','),
    baseUrl
  ]);

  const toggleFilter = () => {
    if (!isFilterOpen) {
      const temp = parents.map(p => p.isChecked);
      setTempParents(temp);
    }
    setIsFilterOpen(!isFilterOpen);
  };

  const toggleParentCheckbox = (id) => {
    setParents(prev => prev.map(p => p.id === id ? { ...p, isChecked: !p.isChecked } : p));
  };

  const applySelection = () => {
    const values = parents.filter(p => p.isChecked).map(p => p.value);
    onUpdateSelectedKeywords(values);
    setIsFilterOpen(false);
  };

  const clearAll = () => {
    setParents(initialParents.map(p => ({ ...p, isChecked: false })));
  };

  const cancel = () => {
    setParents(parents.map((p, i) => ({ ...p, isChecked: tempParents[i] })));
    setIsFilterOpen(false);
  };

  return (
    <div className="searchFilter keywords">
      <Button className="filterButton" onClick={toggleFilter}>
        Keywords
      </Button>

      {isFilterOpen && (
        <div className="filterDropdown">
          <div className="filterOverlay" onClick={toggleFilter}></div>
          <div className="filterHeader">
            <div className="filterName">Keywords</div>
            <div className="filtersFilter">
              <input
                type="text"
                placeholder="Filter keywords..."
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
              />
            </div>
            <button className="closeFilter" onClick={toggleFilter}><AiOutlineClose /></button>
          </div>

          <div className="checkboxFormWrapper" key={parents.map(c => c.isChecked).join('-')}>
            {isLoading ? (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <ClipLoader color="#0070b4" />
              </div>
            ) : (
              parents
                .filter(p => (p.label || '').toLowerCase().includes(filterValue.toLowerCase()))
                .map(parent => (
                  <div className="checkboxWrapper" key={parent.id}>
                    <FormControlLabel
                      className="checkboxForm"
                      label={`${parent.label} (${parent.count})`}
                      control={
                        <Checkbox
                          className="filterCheckbox"
                          checked={parent.isChecked}
                          onChange={() => toggleParentCheckbox(parent.id)}
                        />
                      }
                    />
                  </div>
                ))
            )}
          </div>

          <div className="filterActionButtons">
            <button className="clearButton" onClick={clearAll}>Clear All</button>
            <div>
              <button className="cancelButton" onClick={cancel}>Cancel</button>
              <button className="applyButton" onClick={applySelection}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
