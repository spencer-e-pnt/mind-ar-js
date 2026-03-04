(() => {
    if (typeof MINDAR !== 'undefined') {
        return
    }

    const imageScript = document.createElement('script')
    imageScript.src = 'https://tech.pixelandtexel.com/static/mind-ar/mindar-image.prod.js'
    imageScript.crossOrigin = 'anonymous'
    imageScript.async = true
    imageScript.type = 'module'

    const faceScript = document.createElement('script')
    faceScript.src = 'https://tech.pixelandtexel.com/static/mind-ar/mindar-face.prod.js'
    faceScript.crossOrigin = 'anonymous'
    faceScript.async = true
    faceScript.type = 'module'

    document.head.appendChild(imageScript)
    document.head.appendChild(faceScript)
})();