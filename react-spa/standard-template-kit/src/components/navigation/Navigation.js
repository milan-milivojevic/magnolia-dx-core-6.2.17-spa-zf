import React from "react";
import MenuItem from "./MenuItem";

import { getAPIBase } from "../../helpers/AppHelpers";

function Navigation(props, ref) {

  const [navItems, setNavItems] = React.useState([]);

  React.useEffect(() => {

    async function fetchNav() {
      const apiBase = getAPIBase();
      const url = apiBase + process.env.REACT_APP_MGNL_API_NAV + process.env.REACT_APP_MGNL_APP_BASE;
      const response = await fetch(url);
      const data = await response.json();

      const isPagesApp = window.location.search.includes("mgnlPreview");
      const editMode = isPagesApp ? true : false;
      const baseUrl = process.env.REACT_APP_MGNL_APP_HOST;

      let userGroups = [];

      const PUBLIC_LOGIN = process.env.REACT_APP_MP_PUBLIC_LOGIN || "WABCO-Guestuser";
      const PUBLIC_PASSWORD = process.env.REACT_APP_MP_PUBLIC_PASSWORD || "MediaServices@2017Q3!";
      const PUBLIC_AUTH_STORAGE_KEY_NAV = "MP_PUBLIC_AUTH_TOKEN_NAV";

      const getPublicAccessTokenNav = async () => {
        try {
          const cachedRaw = sessionStorage.getItem(PUBLIC_AUTH_STORAGE_KEY_NAV);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached && cached.access_token && cached.createdAt && (Date.now() - cached.createdAt) < (30 * 60 * 1000)) {
              return cached.access_token;
            }
          }

          const body = new URLSearchParams();
          body.append("login", PUBLIC_LOGIN);
          body.append("password", PUBLIC_PASSWORD);

          const resp = await fetch(`${baseUrl}/rest/sso/auth`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json"
            },
            body: body.toString(),
            credentials: "omit"
          });

          if (!resp.ok) {
            return null;
          }

          const tokenDto = await resp.json();

          if (tokenDto && tokenDto.access_token) {
            sessionStorage.setItem(PUBLIC_AUTH_STORAGE_KEY_NAV, JSON.stringify({ access_token: tokenDto.access_token, createdAt: Date.now() }));
            return tokenDto.access_token;
          }

          return null;

        } catch (e) {
          return null;
        }
      };

      if (editMode === false) {
        let isUserLogged = false;

        try {
          const currentResponse = await fetch(`${baseUrl}/rest/administration/users/_current`, { credentials: "include" });
          if (currentResponse.ok) {
            const currentData = await currentResponse.json();
            isUserLogged = !!currentData?.login;
          }
        } catch (e) {
          isUserLogged = false;
        }

        if (isUserLogged) {
          try {
            const [orgUnitNameResponse, vdbGroupNameResponse] = await Promise.all([
              fetch(`${baseUrl}/rest/administration/users/current`, { credentials: "include" }).then((res) => res.ok ? res.json() : ({})),
              fetch(`${baseUrl}/rest/sso/users/current`, { credentials: "include" }).then((res) => res.ok ? res.json() : ({})),
            ]);

            const orgUnitName = orgUnitNameResponse?.orgUnitName ? "/BM_" + orgUnitNameResponse.orgUnitName : null;
            const vdbGroupName = vdbGroupNameResponse?.vdbGroupName ? "/VDBG_" + vdbGroupNameResponse.vdbGroupName : null;

            userGroups = [orgUnitName, vdbGroupName].filter(Boolean);
          } catch (e) {
            userGroups = [];
          }
        }

        if (!isUserLogged) {
          try {
            const accessToken = await getPublicAccessTokenNav();

            if (accessToken) {
              const headers = {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json"
              };

              const [orgUnitNameResponse, vdbGroupNameResponse] = await Promise.all([
                fetch(`${baseUrl}/rest/administration/users/current`, { headers, credentials: "omit", cache: "no-store" }).then((res) => res.ok ? res.json() : ({})),
                fetch(`${baseUrl}/rest/sso/users/current`, { headers, credentials: "omit", cache: "no-store" }).then((res) => res.ok ? res.json() : ({})),
              ]);

              const orgUnitName = orgUnitNameResponse?.orgUnitName ? "/BM_" + orgUnitNameResponse.orgUnitName : null;
              const vdbGroupName = vdbGroupNameResponse?.vdbGroupName ? "/VDBG_" + vdbGroupNameResponse.vdbGroupName : null;

              userGroups = [orgUnitName, vdbGroupName].filter(Boolean);
            } else {
              userGroups = [];
            }

          } catch (e) {
            userGroups = [];
          }
        }
      }

      const isTrue = (v) => v === true || v === "true";

      const normalizeArray = (v) => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === "string") {
          return v.split(",").map((s) => s.trim()).filter((s) => s);
        }
        if (typeof v === "object") {
          if (Array.isArray(v.items)) {
            return v.items.map((x) => x?.value || x).filter((x) => x);
          }
        }
        return [];
      };

      const aclCache = {};

      const fetchAclForPath = async (path) => {
        if (aclCache[path]) {
          return aclCache[path];
        }
        try {
          const pagesUrl = apiBase + process.env.REACT_APP_MGNL_API_PAGES + path;
          const pageResponse = await fetch(pagesUrl);
          if (!pageResponse.ok) {
            aclCache[path] = {};
            return {};
          }
          const pageData = await pageResponse.json();

          const allowedGroups = pageData.allowedGroups || pageData.acl?.allowedGroups;
          const deniedGroups = pageData.deniedGroups || pageData.acl?.deniedGroups;
          const hideComponent = pageData.hideComponent || pageData.acl?.hideComponent;

          const aclObj = { allowedGroups, deniedGroups, hideComponent };
          aclCache[path] = aclObj;
          return aclObj;
        } catch (e) {
          aclCache[path] = {};
          return {};
        }
      };

      const enrichItemWithAcl = async (navItem) => {
        const hasAclProps = typeof navItem.allowedGroups !== "undefined" || typeof navItem.deniedGroups !== "undefined" || typeof navItem.hideComponent !== "undefined";
        let enriched = navItem;

        if (!hasAclProps) {
          const aclObj = await fetchAclForPath(navItem.path);
          enriched = { ...navItem, ...aclObj };
        }

        if (enriched.children && enriched.children.length > 0) {
          const enrichedChildren = await Promise.all(enriched.children.map(enrichItemWithAcl));
          enriched = { ...enriched, children: enrichedChildren };
        }

        return enriched;
      };

      const canSeeItem = (navItem) => {
        const allowedGroups = normalizeArray(navItem.allowedGroups || navItem.acl?.allowedGroups);
        const deniedGroups = normalizeArray(navItem.deniedGroups || navItem.acl?.deniedGroups);
        const hideComponent = navItem.hideComponent || navItem.acl?.hideComponent;

        if (isTrue(hideComponent)) {
          return false;
        }

        if (allowedGroups.length === 0 && deniedGroups.length === 0) {
          return true;
        }

        if (userGroups.length === 0) {
          return false;
        }

        const isInAllowed = userGroups.some((g) => allowedGroups.includes(g));
        const isInDenied = userGroups.some((g) => deniedGroups.includes(g));

        if (isInDenied && !isInAllowed) {
          return false;
        }

        if (allowedGroups.length > 0 && !isInAllowed) {
          return false;
        }

        return true;
      };

      const filterTreeByAcl = (items) => {
        const filtered = [];

        items.forEach((it) => {
          if (!canSeeItem(it)) {
            return;
          }
          const next = { ...it };
          if (next.children && next.children.length > 0) {
            next.children = filterTreeByAcl(next.children);
          }
          filtered.push(next);
        });

        return filtered;
      };

      let lvl1Items = data["@nodes"].map((nodeName) => {
        return data[nodeName];
      });
      let lvl1ItemsHome = [data, ...lvl1Items];
      const activelvl1Items= lvl1Items.filter((item) => item.hide !== ("true" || true));
      
      const addChildElements = (item) => {
        const navArrObj = {
          name: item.title || item["@name"],
          path: item["@path"],
          id: item["@id"],
          hide: item.hide || false,
          allowedGroups: item.allowedGroups || item.acl?.allowedGroups,
          deniedGroups: item.deniedGroups || item.acl?.deniedGroups,
          hideComponent: item.hideComponent || item.acl?.hideComponent
        };        
        if (item["@nodes"].length > 0) {
          navArrObj.children = getChildren(item);
        }
        return navArrObj;
      };

      const getChildren = (item) => {
        
        const childrenArr = [];
        item["@nodes"].forEach((childItem) => {
          const child = item[`${childItem}`];
          const childObject = {
            name: child.title || child["@name"],
            path: child["@path"],
            id: child["@id"],
            hide: child.hide || false,
            allowedGroups: child.allowedGroups || child.acl?.allowedGroups,
            deniedGroups: child.deniedGroups || child.acl?.deniedGroups,
            hideComponent: child.hideComponent || child.acl?.hideComponent,
            children: [],
          };
          childrenArr.push(childObject);
          if (child["@nodes"].length > 0) {
            childObject.children = getChildren(child);
          }
        });
        return childrenArr;
      };

      let navArr = [];      
      activelvl1Items.forEach((item) => {
        navArr.push(addChildElements(item));
      });

      if (editMode === false) {
        navArr = await Promise.all(navArr.map(enrichItemWithAcl));
        navArr = filterTreeByAcl(navArr);
      }

      setNavItems([...navArr]);
    }

    if (navItems.length < 1) {
      fetchNav();
    }
  }, [navItems]);

  return (
    <React.Fragment>
    <nav className="topNav" ref={ref}>        
      <ul className ={`menus col-${navItems?.length}`}> {
          navItems.map((item, index) => {            
            const depthLevel = 0;

            return (
              <MenuItem
                item = {item}
                itemIndex = {index}
                key = {index}
                depthLevel = {depthLevel}
              />
            );
          })
      } 
      </ul>       
    </nav>
    </React.Fragment>
  )
};

export default Navigation;
