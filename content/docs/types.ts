export type NavLink = { href: string; label: string };
/** One tenvor.io docs subpage. intro and html are the source markup, verbatim, with classes prefixed d- and non-docs links absolute. */
export type DocPage = {
  path: string; kicker: string; title: string; intro: string;
  actions: NavLink[]; toc: NavLink[]; html: string; prev?: NavLink; next?: NavLink;
};
