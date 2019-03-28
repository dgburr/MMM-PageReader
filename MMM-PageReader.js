/*
 * File:        MMM-PageReader.js
 * Created:     24/03/2019 by Daniel Burr <dburr@dburr.net>
 * Description: Main file for MMM-PageReader
 * License:     GNU Public License, version 3
 */

Module.register("MMM-PageReader", {
    defaults: {
        highlight: 'background-color:red;', // CSS to be applied to highlighted sentences
        timeout: 1000,  // amount of time (in ms) to wait before moving to the next sentence.  If set to 0, waits for a PAGE_READER_NEXT event
        notification: null, // if defined, a notification with this name (and payload containing text) will be sent for each sentence
        geometry: {
            width: "100%",  // width of page reading window (px or %)
            height: "100%", // height of page reading window (px or %)
            left: "0",      // X position of page reading window (px)
            top: "0",       // Y position of page reading window (px)
        },
        html: {
            tags: [ 'p', 'h1', 'h2', 'h3', 'h4', 'li' ], // list of tags to parse sentences from
            regions: (url) => { // a list of query selectors to parse sentences from
                return null // parse all regions
            },
            transform: (url, doc) => { // custom HTML transformation rule to be applied after loading
            },
        }
    },

    getStyles: function() {
        return ['MMM-PageReader.css']
    },

    start: function() {
        this.config = this.configAssignment({}, this.defaults, this.config)
        this.reset()
    },

    reset: function() {
        this.paused = false
        this.current_span_index = 0
        this.spans = null
        this.timeout = null
    },

    notificationReceived: function(notification, payload, sender) {
        switch(notification) {
            case "DOM_OBJECTS_CREATED":
                this.prepareReadingWindow()
                this.prepareMessageDialog()
                break
            case "PAGE_READER_LOAD":
                this.sendSocketNotification("PROXY_URL", payload)
                break
            case "PAGE_READER_NEXT":
                this.nextSentence(payload? payload: 1)
                break
            case "PAGE_READER_PREVIOUS":
                this.prevSentence(payload? payload: 1)
                break
            case "PAGE_READER_STOP":
                this.closeWindow()
                break
            case "PAGE_READER_PAUSE":
                if(this.timeout) clearTimeout(this.timeout)
                this.paused = true
                break
            case "PAGE_READER_RESUME":
                if(this.paused) {
                    this.paused = false
                    this.nextSentence()
                }
                break
        }
    },

    getDom: function() {
        return document.createElement("div")
    },

    socketNotificationReceived: function(notification, payload) {
        if(notification == "PROXY") {
            this.dialog_box.style.display = "block"
            this.setDialogMsg("Loading " + payload.orig)

            this.displayWindow(payload.orig, payload.proxy)
        }
    },

    displayWindow: function(url_orig, url_proxied) {
        var self = this
        var iframe = this.page_reader_iframe

        iframe.src = url_proxied
        iframe.onload = function() {
            var doc = iframe.contentDocument || iframe.contentWindow.document

            // add style to apply as highlight
            var style = document.createElement('style')
            style.type = 'text/css'
            style.innerHTML = 'span.highlight {' + self.config.highlight + '}'
            doc.head.appendChild(style)

            // execute (optional) HTML transformation
            if(self.config.html.transform && typeof self.config.html.transform == "function") {
                self.setDialogMsg("Applying HTML transformation")
                try {
                    self.config.html.transform(url_orig, doc)
                } catch(e) {
                    self.log("Transform failed: " + e)
                }
            }

            // determine list of regions to parse
            var regions = []
            if(self.config.html.regions && typeof self.config.html.regions == "function") {
                try {
                    regions = self.config.html.regions(url_orig)
                } catch(e) {
                    self.log("Failed to get regions: " + e)
                }
            }

            if(regions.length == 0) regions.push('')

            // parse sentences
            self.setDialogMsg("Parsing sentences")
            regions.forEach(region => {
                self.config.html.tags.forEach(tag => {
                    self.parseSentences(doc.querySelectorAll(`${region} ${tag}`))
                })
            })

            // get results of parse
            self.current_span_index = 0
            self.spans = doc.querySelectorAll('span.MMM-wrapped-text')

            if(self.spans.length > 0) {
                // start highlighting
                self.highlightSentence()
                // hide dialog box
                self.dialog_box.style.display = 'none'
            } else {
                self.setDialogMsg("Found no sentences to read!")
                self.closeWindow()
            }
        }

        this.page_reader.style.display = "block"
    },

    /*
     * prepareReadingWindow
     *
     * Creates the following elements:
     * > Main window for the reader (this.page_reader, id="PAGE_READER")
     * > IFrame for the content (this.page_reader_iframe, id="PAGE_READER_IFRAME")
     */
    prepareReadingWindow: function() {
        this.page_reader = document.createElement("div")
        this.page_reader.id = "PAGE_READER"
        this.page_reader.style.display = "none"
        this.page_reader.style.width = this.config.geometry.width
        this.page_reader.style.height = this.config.geometry.height
        this.page_reader.style.top = this.config.geometry.top
        this.page_reader.style.left = this.config.geometry.left

        this.page_reader_iframe = document.createElement("iframe")
        this.page_reader_iframe.id = "PAGE_READER_IFRAME"
        this.page_reader_iframe.scrolling = "no"
        this.page_reader.appendChild(this.page_reader_iframe)

        document.getElementsByTagName('body')[0].appendChild(this.page_reader)
    },

    /*
     * prepareMessageDialog
     *
     * Creates the following elements:
     * > Modal dialog box (this.dialog_box, id="PAGE_READER_DIALOG")
     * > Message displayed in dialog box (this.dialog_msg, id="PAGE_READER_DIALOG_MSG")
     */
    prepareMessageDialog: function() {
        this.dialog_box = document.createElement("div")
        this.dialog_box.id = "PAGE_READER_DIALOG"
        this.dialog_box.className = "modal fade"
        this.dialog_box.style.display = "none"

        var div = document.createElement("div")
        div.className = "modal-dialog modal-sm"
        this.dialog_box.appendChild(div)

        var modal_content = document.createElement("div")
        modal_content.className = "modal-content"
        div.appendChild(modal_content)

        var modal_body = document.createElement("div")
        modal_body.className = "modal-body"
        modal_content.appendChild(modal_body)

        this.dialog_msg = document.createElement("p")
        this.dialog_msg.id = "PAGE_READER_DIALOG_MSG"
        modal_body.appendChild(this.dialog_msg)

        var loader = document.createElement("div")
        loader.className = "loader"
        modal_body.appendChild(loader)

        document.getElementsByTagName('body')[0].appendChild(this.dialog_box)
    },

    closeWindow: function() {
        if(this.timeout) clearTimeout(this.timeout)
        // hide page reader and dialog box
        this.page_reader.style.display = "none"
        this.dialog_box.style.display = "none"
        // reset iframe
        this.page_reader_iframe.src = null
        this.page_reader_iframe.onload = null
        this.reset()
    },

    setDialogMsg: function(text) {
        this.dialog_msg.innerHTML = text
        this.log(text)
    },

    /*
     * parseSentences
     *
     * Split each node into sentences and wrap each sentence in <span> nodes
     * of class 'MMM-wrapped-text'
     */
    parseSentences: function(nodes) {
        var count = 0
        for(var i = 0; i < nodes.length; i++) {
            var text = nodes[i].textContent.trim()
            var result = []
            function add(sentence) {
                result += "<span class='MMM-wrapped-text'>" + sentence + "</span>"
                count++
            }

            while(1) {
                var s = text.match(/[^\.?!]*[\.?!]["”']?/)
                if(!s) {
                    if(text.trim().length > 0) add(text)
                    break
                } else {
                    add(s[0])
                    text = text.substr(s[0].length, text.length)
                }
            }

            nodes[i].innerHTML = result
        }

        this.log(`Parsed ${count} sentences`)
    },

    /*
     * highlightSentence
     *
     * Process current sentence (this.spans[this.current_span_index]) and set
     * up timer if requested
     */
    highlightSentence: function() {
        if(this.current_span_index >= this.spans.length) {
            this.closeWindow()
            return
        }

        if(this.config.notification) {
            var text = this.spans[this.current_span_index].innerHTML
            text = this.unencodeHTML(text)
            this.sendNotification(this.config.notification, text)
        }

        this.spans[this.current_span_index].setAttribute("class", "highlight") 
        var pos = this.getPositionOfElement(this.spans[this.current_span_index])
        this.page_reader_iframe.contentWindow.scrollTo(0, pos.y)

        if(this.config.timeout > 0) {
            this.timeout = setTimeout(()=>{
                this.nextSentence()
            }, this.config.timeout)
        }
    },

    nextSentence: function(step = 1) {
        if(this.paused) return

        this.spans[this.current_span_index].removeAttribute("class")
        this.current_span_index += step
        this.highlightSentence()
    },

    prevSentence: function(step = 1) {
        this.spans[this.current_span_index].removeAttribute("class")
        this.current_span_index -= step
        if(this.current_span_index < 0) this.current_span_index = 0
        this.highlightSentence()
    },

    getPositionOfElement: function(elem) {
        var w = elem.offsetWidth
        var h = elem.offsetHeight
        for(var lx = 0, ly = 0; elem != null; lx += elem.offsetLeft, ly += elem.offsetTop, elem = elem.offsetParent) {}
        return {x: lx,
                y: ly,
                w: w,
                h: h}
    },

    configAssignment : function (result) {
        var stack = Array.prototype.slice.call(arguments, 1)
        var item
        var key
        while(stack.length) {
            item = stack.shift()
            for (key in item) {
                if(item.hasOwnProperty(key)) {
                    if(typeof result[key] === 'object' && result[key] && Object.prototype.toString.call(result[key]) !== '[object Array]') {
                        if (typeof item[key] === 'object' && item[key] !== null) {
                            result[key] = this.configAssignment({}, result[key], item[key])
                        } else {
                            result[key] = item[key]
                        }
                    } else {
                        result[key] = item[key]
                    }
                }
            }
        }
        return result
    },

    unencodeHTML: function(escapedHtml) {
        var elem = document.createElement('div')
        elem.innerHTML = escapedHtml
        var result = ''
        for(var i = 0; i < elem.childNodes.length; ++i) {
            result = result + elem.childNodes[i].nodeValue
        }
        return result
    },

    log: function(msg) {
        this.sendSocketNotification("LOG", msg)
    }
})
