/* Shared EN/NL extras, called by each page's language switch.
   Text content is handled by the page itself (data-nl / translation table);
   this covers what text swapping misses: the page language, the tab title,
   and attributes that screen readers, tooltips and form fields use. */
(function(){
  var ATTRS=[['aria','aria-label'],['placeholder','placeholder'],['alt','alt'],['tip','data-tip'],['title','title']];
  window.stacLangExtras=function(lang){
    var root=document.documentElement;
    root.lang=lang;
    if(root.dataset.enTitle===undefined) root.dataset.enTitle=document.title;
    document.title=(lang==='nl'&&root.dataset.nlTitle)?root.dataset.nlTitle:root.dataset.enTitle;
    ATTRS.forEach(function(pair){
      var key=pair[0], attr=pair[1];
      document.querySelectorAll('[data-nl-'+key+']').forEach(function(el){
        var cache='data-en-'+key;
        if(!el.hasAttribute(cache)) el.setAttribute(cache,el.getAttribute(attr)||'');
        el.setAttribute(attr,lang==='nl'?el.getAttribute('data-nl-'+key):el.getAttribute(cache));
      });
    });
  };
})();
