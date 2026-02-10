import React, { useState, useEffect } from "react";
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import { ExpandMore, ChevronRight } from "@mui/icons-material";
import { AiOutlineClose } from "react-icons/ai";
import categoriesPayload from './payloads/categoriesPayload.json';

export default function CategoriesFilter({
  onUpdateSelectedCategories,
  selectedCategories,
  
  query = "",
  sortingType,
  isAsc,
  selectedSuffixes = [],
  selectedVdbs = [],
  selectedKeywords = [],
  selectedFilter1 = [],
  selectedFilter2 = [],
  selectedFilter3 = [],
}) {

  const [parents, setParents] = useState([]);
  const [initialParents, setInitialParents] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempParents, setTempParents] = useState([]);
  const [filterValue, setFilterValue] = useState('');

  const baseUrl = process.env.REACT_APP_MGNL_HOST;

  
  const injectActiveFilters = (payload) => {
    
    if (payload?.criteria?.subs?.[0]?.value !== undefined) {
      payload.criteria.subs[0].value = query;
    }

    
    if (selectedSuffixes?.length) {
      payload.criteria.subs.push({
        "@type": "in",
        "fields": ["extension"],
        "text_value": selectedSuffixes
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
        
        const countPayload = JSON.parse(JSON.stringify(categoriesPayload));
        injectActiveFilters(countPayload);

        const countRes = await fetch(`${baseUrl}/rest/mp/v1.1/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(countPayload),
        });
        const countData = await countRes.json();

        const groups = countData?.aggregations?.categories?.aggs?.id?.subGroups || [];
        const countsMap = new Map();
        groups.forEach(g => countsMap.set(+g.group, g.count));

        
        const themesRes = await fetch(`${baseUrl}/rest/mp/v1.2/themes`);
        const themesData = await themesRes.json();

        
        const transformed = mapThemeTreeToState(themesData, countsMap); 
        setParents(transformed);
        setInitialParents(transformed);
      } catch (e) {
        console.error('Themes filter error:', e);
      }
    })();
  
  }, [
    query, sortingType, isAsc,
    selectedSuffixes.join(','),
    selectedVdbs.join(','),
    selectedKeywords.join(','),
    selectedFilter1.join(','),
    selectedFilter2.join(','),
    selectedFilter3.join(','),
    baseUrl
  ]);

  
  const mapThemeTreeToState = (items, countsMap) => {
    if (!Array.isArray(items)) return [];

    const mapNode = (n) => {
      const children = Array.isArray(n.children) ? n.children.map(mapNode) : null;
      const ownCount = countsMap.get(n.id) || 0;
      const childrenSum = children ? children.reduce((s, c) => s + (c.count || 0), 0) : 0;
      const total = ownCount || childrenSum;

      
      const label =
        (n.name?.EN || n.name?.DE) ??
        (n.label?.EN || n.label?.DE) ??
        n.name ??
        n.label ??
        String(n.id);

      return {
        id: n.id,
        label,
        value: String(n.id),
        count: total,
        isChecked: selectedCategories?.includes(String(n.id)),
        isParentOpen: false,
        children
      };
    };

    
    return items.map(mapNode);
  };

  
  const sortItems = (arr) => {
    const sortAZ = (a, b) => (a.label || '').localeCompare(b.label || '', 'en', { sensitivity: 'base' });
    const withC = arr.filter(x => (x.count || 0) > 0).sort(sortAZ).map(x => x.children ? { ...x, children: sortItems(x.children) } : x);
    const zeroC = arr.filter(x => (x.count || 0) === 0).sort(sortAZ).map(x => x.children ? { ...x, children: sortItems(x.children) } : x);
    return [...withC, ...zeroC];
  };

  
  const extractCheckStates = (items) => items.map(i => ({
    isChecked: i.isChecked,
    children: i.children ? extractCheckStates(i.children) : null
  }));

  const resetCheckStates = (items, states) => items.map((it, i) => ({
    ...it,
    isChecked: states[i].isChecked,
    children: it.children ? resetCheckStates(it.children, states[i].children) : null
  }));

  const toggleFilter = () => {
    if (!isFilterOpen) setTempParents(extractCheckStates(parents));
    setIsFilterOpen(!isFilterOpen);
  };

  const toggleParentDropdown = (id) => setParents(p => p.map(n => n.id === id ? { ...n, isParentOpen: !n.isParentOpen } : n));
  const toggleChildDropdown = (pId, cId) => setParents(p => p.map(n => n.id === pId ? {
    ...n,
    children: n.children?.map(c => c.id === cId ? { ...c, isChildOpen: !c.isChildOpen } : c)
  } : n));
  const toggleSubchildDropdown = (pId, cId, sId) => setParents(p => p.map(n => n.id === pId ? {
    ...n,
    children: n.children?.map(c => c.id === cId ? {
      ...c,
      children: c.children?.map(s => s.id === sId ? { ...s, isSubchildOpen: !s.isSubchildOpen } : s)
    } : c)
  } : n));

  
  const toggleParentCheckbox = (id) => setParents(prev => prev.map(p => {
    if (p.id === id) {
      if (p.children?.length) {
        const allChecked = p.children.every(ch => ch.isChecked);
        p.isChecked = !allChecked;
        p.children.forEach(ch => {
          ch.isChecked = !allChecked;
          ch.children?.forEach(sub => {
            sub.isChecked = !allChecked;
            sub.children?.forEach(gr => gr.isChecked = !allChecked);
          });
        });
      } else {
        p.isChecked = !p.isChecked;
      }
    }
    return p;
  }));

  const toggleChildCheckbox = (pId, cId) => setParents(prev => prev.map(p => {
    if (p.id === pId) {
      p.children = p.children?.map(ch => {
        if (ch.id === cId) {
          if (ch.children?.length) {
            const allSubChecked = ch.children.every(s => s.isChecked);
            ch.isChecked = !allSubChecked;
            ch.children.forEach(s => {
              s.isChecked = !allSubChecked;
              s.children?.forEach(gr => gr.isChecked = !allSubChecked);
            });
          } else {
            ch.isChecked = !ch.isChecked;
          }
        }
        return ch;
      }) || [];
      p.isChecked = p.children.every(ch => ch.isChecked);
    }
    return p;
  }));

  const toggleSubchildCheckbox = (pId, cId, sId) => setParents(prev => prev.map(p => {
    if (p.id === pId) {
      p.children = p.children?.map(ch => {
        if (ch.id === cId) {
          ch.children = ch.children?.map(s => {
            if (s.id === sId) {
              if (s.children?.length) {
                const allGrand = s.children.every(gr => gr.isChecked);
                s.isChecked = !allGrand;
                s.children.forEach(gr => gr.isChecked = !allGrand);
              } else {
                s.isChecked = !s.isChecked;
              }
            }
            return s;
          }) || [];
          ch.isChecked = ch.children.every(s => s.isChecked);
        }
        return ch;
      }) || [];
      p.isChecked = p.children.every(ch => ch.isChecked);
    }
    return p;
  }));

  const toggleGrandchildCheckbox = (pId, cId, sId, gId) => setParents(prev => prev.map(p => {
    if (p.id === pId) {
      p.children = p.children?.map(ch => {
        if (ch.id === cId) {
          ch.children = ch.children?.map(s => {
            if (s.id === sId) {
              s.children = s.children?.map(gr => gr.id === gId ? { ...gr, isChecked: !gr.isChecked } : gr) || [];
              s.isChecked = s.children.every(gr => gr.isChecked);
            }
            return s;
          }) || [];
          ch.isChecked = ch.children.every(s => s.isChecked);
        }
        return ch;
      }) || [];
      p.isChecked = p.children.every(ch => ch.isChecked);
    }
    return p;
  }));

  const applySelection = () => {
    const values = [];
    const traverse = (items) => {
      items.forEach(it => {
        const addSelf = it.children ? it.children.every(ch => ch.isChecked) : it.isChecked;
        if (addSelf) values.push(it.value);
        it.children && traverse(it.children);
      });
    };
    traverse(parents);
    onUpdateSelectedCategories(values);
    setIsFilterOpen(false);
  };

  const clearAll = () => {
    const reset = (items) => items.map(it => ({
      ...it,
      isChecked: false,
      children: it.children ? reset(it.children) : null
    }));
    const cleared = reset(initialParents);
    setParents(cleared);
  };

  const cancel = () => {
    setParents(resetCheckStates(parents, tempParents));
    setIsFilterOpen(false);
  };

  
  const filterTree = (items, q) => {
    if (!q) return items;
    const term = q.toLowerCase();
    const matchNode = (n) => (n.label || '').toLowerCase().includes(term);
    const recur = (arr) => arr.map(n => {
      const children = n.children ? recur(n.children).filter(Boolean) : null;
      if (matchNode(n) || (children && children.length)) {
        return { ...n, children };
      }
      return null;
    }).filter(Boolean);
    return recur(items);
  };

  const renderedParents = filterTree(parents, filterValue);

  return (
    <div className="searchFilter categories">
      
      <Button className="filterButton" onClick={toggleFilter}>Themes</Button>

      {isFilterOpen && (
        <div className="filterDropdown">
          <div className="filterOverlay" onClick={toggleFilter}></div>
          <div className="filterHeader">
            <div className="filterName">Themes</div>
            <div className="filtersFilter">
              <input
                type="text"
                placeholder="Filter themes..."
                value={filterValue}
                onChange={e => setFilterValue(e.target.value)}
              />
            </div>
            <button className="closeFilter" onClick={toggleFilter}><AiOutlineClose /></button>
          </div>

          <div className="checkboxFormWrapper parent" key={parents.map(p => p.isChecked).join('-')}>
            {renderedParents.map(parent => (
              <div className="filterCheckboxes" key={parent.id}>
                <div className="checkboxWrapper">
                  {parent.children ? (
                    <div className="filtersChevron" onClick={() => toggleParentDropdown(parent.id)}>
                      {parent.isParentOpen ? <ExpandMore /> : <ChevronRight />}
                    </div>
                  ) : <div className="noSublevels"></div>}
                  <FormControlLabel
                    label={`${parent.label} (${parent.count || 0})`}
                    className="checkboxForm"
                    control={
                      <Checkbox
                        className="filterCheckbox"
                        checked={parent.children ? parent.children.every(ch => ch.isChecked) : parent.isChecked}
                        indeterminate={parent.children && parent.children.some(ch => ch.isChecked) && !parent.children.every(ch => ch.isChecked)}
                        onChange={() => toggleParentCheckbox(parent.id)}
                      />
                    }
                  />
                </div>

                {parent.children && (
                  <div className="checkboxFormWrapper child" style={{ display: parent.isParentOpen ? 'flex' : 'none' }}
                    key={parent.children.map(c => c.isChecked).join('-')}
                  >
                    {parent.children.map(child => (
                      <div className="filterCheckboxes" key={child.id}>
                        <div className="checkboxWrapper">
                          {child.children ? (
                            <div className="filtersChevron" onClick={() => toggleChildDropdown(parent.id, child.id)}>
                              {child.isChildOpen ? <ExpandMore /> : <ChevronRight />}
                            </div>
                          ) : <div className="noSublevels"></div>}
                          <FormControlLabel
                            className="checkboxForm"
                            label={`${child.label} (${child.count || 0})`}
                            control={
                              <Checkbox
                                className="filterCheckbox"
                                checked={child.children ? child.children.every(sub => sub.isChecked) : child.isChecked}
                                indeterminate={child.children && child.children.some(sub => sub.isChecked) && !child.children.every(sub => sub.isChecked)}
                                onChange={() => toggleChildCheckbox(parent.id, child.id)}
                              />
                            }
                          />
                        </div>

                        {child.children && (
                          <div className="checkboxFormWrapper subchild" style={{ display: child.isChildOpen ? 'flex' : 'none' }}
                            key={child.children.map(c => c.isChecked).join('-')}
                          >
                            {child.children.map(subchild => (
                              <div className="filterCheckboxes" key={subchild.id}>
                                <div className="checkboxWrapper">
                                  {subchild.children ? (
                                    <div className="filtersChevron" onClick={() => toggleSubchildDropdown(parent.id, child.id, subchild.id)}>
                                      {subchild.isSubchildOpen ? <ExpandMore /> : <ChevronRight />}
                                    </div>
                                  ) : <div className="noSublevels"></div>}
                                  <FormControlLabel
                                    className="checkboxForm"
                                    label={`${subchild.label} (${subchild.count || 0})`}
                                    control={
                                      <Checkbox
                                        className="filterCheckbox"
                                        checked={subchild.children ? subchild.children.every(gr => gr.isChecked) : subchild.isChecked}
                                        indeterminate={subchild.children && subchild.children.some(gr => gr.isChecked) && !subchild.children.every(gr => gr.isChecked)}
                                        onChange={() => toggleSubchildCheckbox(parent.id, child.id, subchild.id)}
                                      />
                                    }
                                  />
                                </div>

                                {subchild.children && (
                                  <div className="checkboxFormWrapper grandchild" style={{ display: subchild.isSubchildOpen ? 'flex' : 'none' }}
                                    key={subchild.children.map(c => c.isChecked).join('-')}
                                  >
                                    {subchild.children.map(grandchild => (
                                      <div className="filterCheckboxes" key={grandchild.id}>
                                        <div className="checkboxWrapper">
                                          <FormControlLabel
                                            className="checkboxForm"
                                            label={`${grandchild.label} (${grandchild.count || 0})`}
                                            control={
                                              <Checkbox
                                                className="filterCheckbox"
                                                checked={grandchild.isChecked}
                                                onChange={() => {
                                                  
                                                  setParents(prev => prev.map(p => {
                                                    if (p.id !== parent.id) return p;
                                                    p.children = p.children.map(ch => {
                                                      if (ch.id !== child.id) return ch;
                                                      ch.children = ch.children.map(sc => {
                                                        if (sc.id !== subchild.id) return sc;
                                                        sc.children = sc.children.map(gr => gr.id === grandchild.id ? { ...gr, isChecked: !gr.isChecked } : gr);
                                                        sc.isChecked = sc.children.every(gr => gr.isChecked);
                                                        return sc;
                                                      });
                                                      ch.isChecked = ch.children.every(sc => sc.isChecked);
                                                      return ch;
                                                    });
                                                    p.isChecked = p.children.every(ch => ch.isChecked);
                                                    return p;
                                                  }));
                                                }}
                                              />
                                            }
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
