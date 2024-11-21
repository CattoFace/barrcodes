function set_theme(color_scheme) { // toggle between dark and light theme(default dark)
  document.body.style.setProperty("color-scheme", color_scheme)
  localStorage.setItem('color-scheme', color_scheme)
}
const cache = new Map()
function get_post(post_name) { // download the requested document if it is not already in cache
  let post = cache.get(post_name)
  if (!post) {
    main = fetch(post_name + "main-only.html").then(response => response.text())
    head = fetch(post_name + "head-only.html").then(response => response.text())
    post = [head, main]
    cache.set(post_name, post) // post is a promise until resolved by replace_content
  }
  return post
}
function replace_content(post_name) {
  [head, main] = get_post(post_name)
  if (head instanceof Promise) {// if promise, convert to actual post and save
    Promise.all([head, main]).then(([head, main]) => {
      document.head.innerHTML = head
      document.getElementById("content").innerHTML = main
      cache.set(post_name, [head, main])
    })
  } else {
    document.head.innerHTML = head
    document.getElementById("content").innerHTML = main
  }
}
var r = new RegExp('^(//|[a-z]+:)', 'i'); // check for relative link
document.addEventListener('click', e => { // replace relative links with document replacements
  const origin = e.target.closest('a')
  if (!origin) return; // not a link
  let post_name = origin.getAttribute("href")
  if (r.test(post_name) || post_name.indexOf('.') > -1 || post_name.charAt(0) == '#') return; // not link to a document
  e.preventDefault() // relative links do not actually load a new webpage
  console.log(post_name)
  if (window.location.pathname == post_name) return; // already on that page
  replace_content(post_name)
  history.pushState({}, "", post_name)
})
document.addEventListener('mouseover', e => { // start fetching document on hover
  const origin = e.target.closest('a')
  if (!origin) return; // not a link
  let post_name = origin.getAttribute("href")
  if (r.test(post_name) || post_name.indexOf('.') > -1 || post_name.charAt(0) == '#') return; // not link to a document
  if (window.location.pathname == post_name) return; // already on that page
  get_post(post_name)
})
onpopstate = (_) => replace_content(window.location.pathname) // handle back button
window.addEventListener("DOMContentLoaded", _ => {
  color_scheme = localStorage.getItem("color-scheme") || "light dark" // load saved scheme
  set_theme(color_scheme)
  document.getElementById("theme_select_inner").value = color_scheme
})
