import React, { useEffect, useState } from "react";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Button from "@mui/material/Button";
import { ExpandMore, ChevronRight } from "@mui/icons-material";
import { AiOutlineClose } from "react-icons/ai";
import filter2Payload from "./payloads/filter2Payload.json";

export default function Filter2({
  onUpdateSelectedFilter2,
  selectedFilter2 = [],
  query = "",
  sortingType,
  isAsc,
  selectedCategories = [],
  selectedSuffixes = [],
  selectedKeywords = [],
  selectedVdbs = [],
  selectedFilter1 = [],
  selectedFilter3 = [],
}) {
  const [parents, setParents] = useState([]);
  const [initialParents, setInitialParents] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempParents, setTempParents] = useState([]);
  const [filterValue, setFilterValue] = useState("");

  const baseUrl = process.env.REACT_APP_MGNL_HOST;

  const injectActiveFilters = (payload) => {
    try {
      payload.criteria.subs[0].subs[0].value = query ?? "";
      payload.criteria.subs[0].subs[1].value = query ?? "";
    } catch {}

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
        const countPayload = JSON.parse(JSON.stringify(filter2Payload));
        injectActiveFilters(countPayload);

        const countRes = await fetch(`${baseUrl}/rest/mp/v1.1/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(countPayload),
        });
        const countData = await countRes.json();

        const groups =
          countData?.aggregations?.customAttribute_450?.aggs?.id?.subGroups ||
          countData?.aggregations?.customAttribute_450?.subGroups ||
          [];
        const countsMap = new Map();
        groups.forEach((g) => countsMap.set(+g.group, g.count));

        const treeRes = await fetch(`${baseUrl}/rest/mp/v1.0/asset-attributes/450/trees`);
        const treeData = await treeRes.json();

        const transformed = mapTree(treeData, countsMap);

        setParents(transformed);
        setInitialParents(transformed);
      } catch (e) {
        console.error("Filter2 error:", e);
      }
    })();
  }, [
    query, sortingType, isAsc,
    selectedCategories.join(","),
    selectedSuffixes.join(","),
    selectedKeywords.join(","),
    selectedVdbs.join(","),
    selectedFilter1.join(","),
    selectedFilter3.join(","),
    baseUrl,
  ]);

  const mapTree = (nodes, countsMap) => {
    if (!Array.isArray(nodes)) return [];
    const mapNode = (n) => {
      const children = Array.isArray(n.children) ? n.children.map(mapNode) : null;

      const id = n.id ?? n.value?.id;
      const nameEN =
        n.name?.EN ?? n.value?.name?.EN ?? n.label?.EN ?? n.value?.label?.EN;
      const nameDE =
        n.name?.DE ?? n.value?.name?.DE ?? n.label?.DE ?? n.value?.label?.DE;
      const label = nameEN || nameDE || n.name || n.label || String(id);

      const own = countsMap.get(Number(id)) || 0;
      const childSum = children ? children.reduce((s, c) => s + (c.count || 0), 0) : 0;
      const total = own || childSum;

      return {
        id,
        label,
        value: String(id),
        count: total,
        isChecked: selectedFilter2.includes(String(id)),
        isParentOpen: false,
        children,
      };
    };

    return nodes.map(mapNode);
  };

  const applySelectionToTree = (nodes, selected) => {
    const sel = new Set((selected || []).map(String));
    const walk = (arr) =>
      (arr || []).map((n) => {
        const children = n.children ? walk(n.children) : null;
        const isLeaf = !children || children.length === 0;
        const isChecked = isLeaf ? sel.has(String(n.id)) : children.every((c) => c.isChecked);
        return { ...n, isChecked, children };
      });
    return walk(nodes);
  };
  useEffect(() => {
    if (!parents.length) return;
    setParents((prev) => applySelectionToTree(prev, selectedFilter2));
  }, [selectedFilter2.join(','), parents.length]);

  const extractCheckStates = (items) =>
    items.map((i) => ({
      isChecked: i.isChecked,
      children: i.children ? extractCheckStates(i.children) : null,
    }));

  const resetCheckStates = (items, states) =>
    items.map((it, i) => ({
      ...it,
      isChecked: states[i].isChecked,
      children: it.children ? resetCheckStates(it.children, states[i].children) : null,
    }));

  const toggleFilter = () => {
    if (!isFilterOpen) setTempParents(extractCheckStates(parents));
    setIsFilterOpen(!isFilterOpen);
  };

  const toggleParentDropdown = (id) =>
    setParents((p) => p.map((n) => (n.id === id ? { ...n, isParentOpen: !n.isParentOpen } : n)));
  const toggleChildDropdown = (pId, cId) =>
    setParents((p) =>
      p.map((n) =>
        n.id === pId
          ? {
              ...n,
              children: n.children?.map((c) =>
                c.id === cId ? { ...c, isChildOpen: !c.isChildOpen } : c
              ),
            }
          : n
      )
    );
  const toggleSubchildDropdown = (pId, cId, sId) =>
    setParents((p) =>
      p.map((n) =>
        n.id === pId
          ? {
              ...n,
              children: n.children?.map((c) =>
                c.id === cId
                  ? {
                      ...c,
                      children: c.children?.map((s) =>
                        s.id === sId ? { ...s, isSubchildOpen: !s.isSubchildOpen } : s
                      ),
                    }
                  : c
              ),
            }
          : n
      )
    );

  const toggleParentCheckbox = (id) =>
    setParents((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          if (p.children?.length) {
            const allChecked = p.children.every((ch) => ch.isChecked);
            p.isChecked = !allChecked;
            p.children.forEach((ch) => {
              ch.isChecked = !allChecked;
              ch.children?.forEach((sub) => {
                sub.isChecked = !allChecked;
                sub.children?.forEach((gr) => (gr.isChecked = !allChecked));
              });
            });
          } else p.isChecked = !p.isChecked;
        }
        return p;
      })
    );

  const toggleChildCheckbox = (pId, cId) =>
    setParents((prev) =>
      prev.map((p) => {
        if (p.id === pId) {
          p.children = p.children?.map((ch) => {
            if (ch.id === cId) {
              if (ch.children?.length) {
                const allSub = ch.children.every((s) => s.isChecked);
                ch.isChecked = !allSub;
                ch.children.forEach((s) => {
                  s.isChecked = !allSub;
                  s.children?.forEach((gr) => (gr.isChecked = !allSub));
                });
              } else ch.isChecked = !ch.isChecked;
            }
            return ch;
          });
          p.isChecked = p.children?.every((ch) => ch.isChecked);
        }
        return p;
      })
    );

  const toggleSubchildCheckbox = (pId, cId, sId) =>
    setParents((prev) =>
      prev.map((p) => {
        if (p.id === pId) {
          p.children = p.children?.map((ch) => {
            if (ch.id === cId) {
              ch.children = ch.children?.map((s) => {
                if (s.id === sId) {
                  if (s.children?.length) {
                    const allG = s.children.every((g) => g.isChecked);
                    s.isChecked = !allG;
                    s.children.forEach((g) => (g.isChecked = !allG));
                  } else s.isChecked = !s.isChecked;
                }
                return s;
              });
              ch.isChecked = ch.children?.every((s) => s.isChecked);
            }
            return ch;
          });
          p.isChecked = p.children?.every((ch) => ch.isChecked);
        }
        return p;
      })
    );

  const toggleGrandchildCheckbox = (pId, cId, sId, gId) =>
    setParents((prev) =>
      prev.map((p) => {
        if (p.id === pId) {
          p.children = p.children?.map((ch) => {
            if (ch.id === cId) {
              ch.children = ch.children?.map((s) => {
                if (s.id === sId) {
                  s.children = s.children?.map((g) =>
                    g.id === gId ? { ...g, isChecked: !g.isChecked } : g
                  );
                  s.isChecked = s.children?.every((g) => g.isChecked);
                }
                return s;
              });
              ch.isChecked = ch.children?.every((s) => s.isChecked);
            }
            return ch;
          });
          p.isChecked = p.children?.every((ch) => ch.isChecked);
        }
        return p;
      })
    );

  const applySelection = () => {
    const values = [];
    const traverse = (items) => {
      items.forEach((it) => {
        const addSelf = it.children ? it.children.every((ch) => ch.isChecked) : it.isChecked;
        if (addSelf) values.push(it.value);
        it.children && traverse(it.children);
      });
    };
    traverse(parents);
    onUpdateSelectedFilter2(values);
    setIsFilterOpen(false);
  };

  const clearAll = () => {
    const reset = (items) =>
      items.map((it) => ({
        ...it,
        isChecked: false,
        children: it.children ? reset(it.children) : null,
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
    const matchNode = (n) => (n.label || "").toLowerCase().includes(term);
    const recur = (arr) =>
      arr
        .map((n) => {
          const children = n.children ? recur(n.children).filter(Boolean) : null;
          if (matchNode(n) || (children && children.length)) return { ...n, children };
          return null;
        })
        .filter(Boolean);
    return recur(items);
  };

  const renderedParents = filterTree(parents, filterValue);

  return (
    <div className="searchFilter filter2">
      <Button className="filterButton" onClick={toggleFilter}>Asset Type</Button>

      {isFilterOpen && (
        <div className="filterDropdown">
          <div className="filterOverlay" onClick={toggleFilter}></div>
          <div className="filterHeader">
            <div className="filterName">Asset Type</div>
            <div className="filtersFilter">
              <input
                type="text"
                placeholder="Filter asset types..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
            </div>
            <button className="closeFilter" onClick={toggleFilter}><AiOutlineClose /></button>
          </div>

          <div className="checkboxFormWrapper parent" key={parents.map((p) => p.isChecked).join("-")}>
            {renderedParents.map((parent) => (
              <div className="filterCheckboxes" key={parent.id}>
                <div className="checkboxWrapper">
                  {parent.children ? (
                    <div className="filtersChevron" onClick={() => toggleParentDropdown(parent.id)}>
                      {parent.isParentOpen ? <ExpandMore /> : <ChevronRight />}
                    </div>
                  ) : (
                    <div className="noSublevels"></div>
                  )}
                  <FormControlLabel
                    className="checkboxForm"
                    label={`${parent.label} (${parent.count || 0})`}
                    control={
                      <Checkbox
                        className="filterCheckbox"
                        checked={parent.children ? parent.children.every((ch) => ch.isChecked) : parent.isChecked}
                        indeterminate={
                          parent.children &&
                          parent.children.some((ch) => ch.isChecked) &&
                          !parent.children.every((ch) => ch.isChecked)
                        }
                        onChange={() => toggleParentCheckbox(parent.id)}
                      />
                    }
                  />
                </div>

                {parent.children && (
                  <div
                    className="checkboxFormWrapper child"
                    style={{ display: parent.isParentOpen ? "flex" : "none" }}
                    key={parent.children.map((c) => c.isChecked).join("-")}
                  >
                    {parent.children.map((child) => (
                      <div className="filterCheckboxes" key={child.id}>
                        <div className="checkboxWrapper">
                          {child.children ? (
                            <div className="filtersChevron" onClick={() => toggleChildDropdown(parent.id, child.id)}>
                              {child.isChildOpen ? <ExpandMore /> : <ChevronRight />}
                            </div>
                          ) : (
                            <div className="noSublevels"></div>
                          )}
                          <FormControlLabel
                            className="checkboxForm"
                            label={`${child.label} (${child.count || 0})`}
                            control={
                              <Checkbox
                                className="filterCheckbox"
                                checked={child.children ? child.children.every((sub) => sub.isChecked) : child.isChecked}
                                indeterminate={
                                  child.children &&
                                  child.children.some((sub) => sub.isChecked) &&
                                  !child.children.every((sub) => sub.isChecked)
                                }
                                onChange={() => toggleChildCheckbox(parent.id, child.id)}
                              />
                            }
                          />
                        </div>

                        {child.children && (
                          <div
                            className="checkboxFormWrapper subchild"
                            style={{ display: child.isChildOpen ? "flex" : "none" }}
                            key={child.children.map((c) => c.isChecked).join("-")}
                          >
                            {child.children.map((subchild) => (
                              <div className="filterCheckboxes" key={subchild.id}>
                                <div className="checkboxWrapper">
                                  {subchild.children ? (
                                    <div className="filtersChevron" onClick={() => toggleSubchildDropdown(parent.id, child.id, subchild.id)}>
                                      {subchild.isSubchildOpen ? <ExpandMore /> : <ChevronRight />}
                                    </div>
                                  ) : (
                                    <div className="noSublevels"></div>
                                  )}
                                  <FormControlLabel
                                    className="checkboxForm"
                                    label={`${subchild.label} (${subchild.count || 0})`}
                                    control={
                                      <Checkbox
                                        className="filterCheckbox"
                                        checked={subchild.children ? subchild.children.every((gr) => gr.isChecked) : subchild.isChecked}
                                        indeterminate={
                                          subchild.children &&
                                          subchild.children.some((gr) => gr.isChecked) &&
                                          !subchild.children.every((gr) => gr.isChecked)
                                        }
                                        onChange={() => toggleSubchildCheckbox(parent.id, child.id, subchild.id)}
                                      />
                                    }
                                  />
                                </div>

                                {subchild.children && (
                                  <div
                                    className="checkboxFormWrapper grandchild"
                                    style={{ display: subchild.isSubchildOpen ? "flex" : "none" }}
                                    key={subchild.children.map((c) => c.isChecked).join("-")}
                                  >
                                    {subchild.children.map((grandchild) => (
                                      <div className="filterCheckboxes" key={grandchild.id}>
                                        <div className="checkboxWrapper">
                                          <FormControlLabel
                                            className="checkboxForm"
                                            label={`${grandchild.label} (${grandchild.count || 0})`}
                                            control={
                                              <Checkbox
                                                className="filterCheckbox"
                                                checked={grandchild.isChecked}
                                                onChange={() =>
                                                  setParents((prev) =>
                                                    prev.map((p) => {
                                                      if (p.id !== parent.id) return p;
                                                      p.children = p.children.map((ch) => {
                                                        if (ch.id !== child.id) return ch;
                                                        ch.children = ch.children.map((sc) => {
                                                          if (sc.id !== subchild.id) return sc;
                                                          sc.children = sc.children.map((gr) =>
                                                            gr.id === grandchild.id ? { ...gr, isChecked: !gr.isChecked } : gr
                                                          );
                                                          sc.isChecked = sc.children.every((gr) => gr.isChecked);
                                                          return sc;
                                                        });
                                                        ch.isChecked = ch.children.every((sc) => sc.isChecked);
                                                        return ch;
                                                      });
                                                      p.isChecked = p.children.every((ch) => ch.isChecked);
                                                      return p;
                                                    })
                                                  )
                                                }
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
