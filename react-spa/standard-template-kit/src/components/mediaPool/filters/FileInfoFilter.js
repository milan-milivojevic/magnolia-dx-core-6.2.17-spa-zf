import React, { useState, useEffect } from "react";
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import { ExpandMore, ChevronRight } from "@mui/icons-material";
import { AiOutlineClose } from "react-icons/ai";
import fileInfoFilterPayload from './payloads/fileInfoFilterPayload.json';

export default function FileInfoFilter({
  onUpdateSelectedSuffixes,
  selectedSuffixes,
  query = "",
  sortingType,
  isAsc,
  selectedCategories = [],
  selectedKeywords = [],
  selectedVdbs = [],
  selectedFilter1 = [],
  selectedFilter2 = [],
  selectedFilter3 = [],
}) {

  const [parents, setParents] = useState([]);
  const [initialParents, setInitialParents] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempParents, setTempParents] = useState([]);

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

    if (selectedKeywords?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["structuredKeywords.id"],
        "long_value": selectedKeywords,
        "any": true
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
        const countPayload = JSON.parse(JSON.stringify(fileInfoFilterPayload));
        injectActiveFilters(countPayload);

        const countRes = await fetch(`${baseUrl}/rest/mp/v1.1/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(countPayload)
        });
        const countData = await countRes.json();

        const countGroups =
          countData?.aggregations?.fileSuffix?.subGroups ||
          countData?.aggregations?.fileSuffix?.aggs?.id?.subGroups ||
          [];

        const countsMap = new Map();
        countGroups.forEach(g => countsMap.set(g.group, g.count));

        const suffixRes = await fetch(`${baseUrl}/rest/mp/v1.1/suffixes`);
        const suffixData = await suffixRes.json();

        const transformed = mapAndSort(suffixData, countsMap);
        setParents(transformed);
        setInitialParents(transformed);
      } catch (e) {
        console.error('FileInfo filter error:', e);
      }
    })();
  }, [
    query, sortingType, isAsc,
    selectedCategories.join(','),
    selectedKeywords.join(','),
    selectedVdbs.join(','),
    selectedFilter1.join(','),
    selectedFilter2.join(','),
    selectedFilter3.join(','),
    baseUrl
  ]);

  const mapAndSort = (data, countsMap) => {
    const mapParent = (item) => {
      const children = (item.suffixes || []).map((suffix, i) => {
        const cnt = countsMap.get(suffix) || 0;
        return {
          id: i + 1,
          label: suffix,
          value: suffix,
          count: cnt,
          isChecked: selectedSuffixes?.includes(suffix)
        };
      });

      const sumCount = children.reduce((s, c) => s + (c.count || 0), 0);

      return {
        id: item.name,
        label: item.label,
        count: sumCount,
        isParentOpen: false,
        children
      };
    };

    const parentsMapped = data.map(mapParent);
    return parentsMapped;
  };

  const extractCheckStates = (items) => items.map(item => ({
    isChecked: item.isChecked,
    children: item.children ? extractCheckStates(item.children) : null
  }));

  const resetCheckStates = (items, tempStates) => items.map((item, index) => ({
    ...item,
    isChecked: tempStates[index].isChecked,
    children: item.children ? resetCheckStates(item.children, tempStates[index].children) : null
  }));

  const toggleFilter = () => {
    if (!isFilterOpen) setTempParents(extractCheckStates(parents));
    setIsFilterOpen(!isFilterOpen);
  };

  const toggleParentDropdown = (parentId) => {
    setParents(prev => prev.map(p => p.id === parentId ? { ...p, isParentOpen: !p.isParentOpen } : p));
  };

  const toggleParentCheckbox = (parentId) => {
    setParents(prev => prev.map(p => {
      if (p.id === parentId) {
        const allChecked = p.children.every(ch => ch.isChecked);
        p.children = p.children.map(ch => ({ ...ch, isChecked: !allChecked }));
      }
      return p;
    }));
  };

  const toggleChildCheckbox = (parentId, childId) => {
    setParents(prev => prev.map(p => {
      if (p.id === parentId) {
        p.children = p.children.map(ch => ch.id === childId ? { ...ch, isChecked: !ch.isChecked } : ch);
      }
      return p;
    }));
  };

  const applySelection = () => {
    const values = [];
    parents.forEach(p => p.children.forEach(ch => ch.isChecked && values.push(ch.value)));
    onUpdateSelectedSuffixes(values);
    setIsFilterOpen(false);
  };

  const clearAll = () => {
    setParents(initialParents.map(p => ({
      ...p,
      isChecked: false,
      children: p.children?.map(ch => ({ ...ch, isChecked: false })) || []
    })));
  };

  const cancel = () => {
    setParents(resetCheckStates(parents, tempParents));
    setIsFilterOpen(false);
  };

  return (
    <div className="searchFilter suffixes">
      <Button className="filterButton" onClick={toggleFilter}>
        File Information
      </Button>

      {isFilterOpen && (
        <div className="filterDropdown">
          <div className="filterOverlay" onClick={toggleFilter}></div>
          <div className="filterHeader">
            <div className="filterName">File Information</div>
            <button className="closeFilter" onClick={toggleFilter}><AiOutlineClose /></button>
          </div>

          <div className="checkboxFormWrapper parent" key={parents.map(c => c.isChecked).join('-')}>
            {parents.map(parent => (
              <div className="filterCheckboxes" key={parent.id}>
                <div className="checkboxWrapper">
                  <div className="filtersChevron" onClick={() => toggleParentDropdown(parent.id)}>
                    {parent.isParentOpen ? <ExpandMore /> : <ChevronRight />}
                  </div>
                  <FormControlLabel
                    className="checkboxForm"
                    label={`${parent.label} (${parent.count || 0})`}
                    control={
                      <Checkbox
                        className="filterCheckbox"
                        checked={parent.children?.every(ch => ch.isChecked)}
                        indeterminate={
                          parent.children?.some(ch => ch.isChecked) &&
                          !parent.children?.every(ch => ch.isChecked)
                        }
                        onChange={() => toggleParentCheckbox(parent.id)}
                      />
                    }
                  />
                </div>

                <div className="checkboxFormWrapper child" style={{ display: parent.isParentOpen ? 'flex' : 'none' }}
                  key={parent.children?.map(c => c.isChecked).join('-')}
                >
                  {parent.children?.map(child => (
                    <div className="checkboxWrapper" key={child.id}>
                      <FormControlLabel
                        className="checkboxForm"
                        label={`${child.label} (${child.count || 0})`}
                        control={
                          <Checkbox
                            className="filterCheckbox"
                            checked={child.isChecked}
                            onChange={() => toggleChildCheckbox(parent.id, child.id)}
                          />
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
