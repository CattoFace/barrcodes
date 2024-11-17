const cache = new Map()
let content_div = undefined
let theme_button = undefined
function toggle_theme() { // toggle between dark and light theme(default dark)
  const light = document.body.classList.toggle("light")
  theme_button.innerHTML = light ? "Light<br/>Theme" : "Dark<br/>Theme"
  localStorage.setItem('light_mode', light)
}
function get_document(doc_name) { // download the requested document if it is not already in cache
  let doc = cache.get(doc_name)
  if (!doc) {
    doc = fetch("fragment/" + doc_name).then(response => response.text())
    cache.set(doc_name, doc) // doc is a promise until resolved by replace_content
  }
  return doc
}
function replace_content(doc_name) { // replace the content with the requested document
  let doc = get_document(doc_name)
  if (doc instanceof Promise) { // if promise, convert to actual doc and save
    doc.then(resolved => {
      cache.set(doc_name, resolved)
      content_div.innerHTML = resolved
      title = document.getElementById("title")
      document.title = "BarrCodes - " + (title ? title.textContent : doc_name)
    })
  } else {
    content_div.innerHTML = doc
    title = document.getElementById("title")
    document.title = "BarrCodes - " + (title ? title.textContent : doc_name)
  }
}
var r = new RegExp('^(//|[a-z]+:)', 'i'); // check for relative link
document.addEventListener('click', e => { // replace relative links with document replacements
  const origin = e.target.closest('a')
  if (!origin) return; // not a link
  let doc_name = origin.getAttribute("href")
  if (r.test(doc_name) || doc_name.indexOf('.') > -1 || doc_name.charAt(0) == '#') return; // not link to a document
  e.preventDefault() // relative links do not actually load a new webpage
  if ((window.location.pathname.slice(1) || "index") == doc_name) return; // already on that page
  replace_content(doc_name)
  history.pushState({}, "", doc_name)
})
document.addEventListener('mouseover', e => { // start fetching document on hover
  const origin = e.target.closest('a')
  if (!origin) return; // not a link
  let doc_name = origin.getAttribute("href")
  if (r.test(doc_name) || doc_name.indexOf('.') > -1 || doc_name.indexOf('#') > -1) return; // not link to a document
  if ((window.location.pathname.slice(1) || "index") == doc_name) return; // already on that page
  get_document(doc_name)
})
onpopstate = (_) => replace_content(window.location.pathname.slice(1) || "index") // handle back button
window.addEventListener("DOMContentLoaded", _ => {
  content_div = document.getElementById("content")
  theme_button = document.getElementById("toggle_theme")
  if (localStorage.getItem("light_mode") === "true") toggle_theme(); // load saved theme
})
