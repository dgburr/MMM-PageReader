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
            regions: (url) => { // return a list of regions to parse sentences from
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

    socketNotificationReceived: function(noti, payload) {
        if(noti == "PROXIED_URL") {
            var dialog = document.getElementById("PAGE_READER_DIALOG")
            dialog.style.display = "block"

            var dialog_msg = document.getElementById("PAGE_READER_DIALOG_MSG")
            dialog_msg.innerHTML = "Loading " + payload

            this.displayWindow(payload)
        }
    },

    displayWindow: function(url) {
        var self = this

        var iframe = document.getElementById("PAGE_READER_IFRAME")
        var reader = document.getElementById("PAGE_READER")
        var dialog = document.getElementById("PAGE_READER_DIALOG")
        var dialog_msg = document.getElementById("PAGE_READER_DIALOG_MSG")

        iframe.src = url
        iframe.onload = function() {
            var doc = iframe.contentDocument || iframe.contentWindow.document

            // add style to apply as highlight
            var style = document.createElement('style')
            style.type = 'text/css'
            style.innerHTML = 'span.highlight {' + self.config.highlight + '}'
            doc.head.appendChild(style)

            // execute (optional) HTML transformation
            if(self.config.html.transform && typeof self.config.html.transform == "function") {
                dialog_msg.innerHTML = "Applying transform"
                try {
                    self.config.html.transform(url, doc)
                } catch(e) {
                    self.log("Transform failed: " + e)
                }
            }

            // determine list of regions to parse
            var regions = [ doc ]
            if(self.config.html.regions && typeof self.config.html.regions == "function") {
                dialog_msg.innerHTML = "Finding regions"
                try {
                    var list = self.config.html.regions(url)
                    if(list) {
                        regions = []
                        list.forEach(region => {
                            var node = doc.getElementsByClassName(region)
                            if(node) regions.push(node)
                        })
                    }
                } catch(e) {
                    self.log("Regions failed: " + e)
                }
            }

            var msg = "Got " + regions.length + " regions: " + regions
            dialog_msg.innerHTML = msg
            self.log(msg)

            // wrap sentences in spans of class 'MMM-wrapped-text'
            regions.forEach(region => {
                self.config.html.tags.forEach(tag => {
                    self.parseSentences(region, tag)
                })
            })

            // get results of parse
            self.current_span_index = 0
            self.spans = doc.querySelectorAll('span.MMM-wrapped-text')

            if(self.spans.length > 0) {
                self.highlightSentence() // start highlighting
            } else {
                dialog_msg.innerHTML = "Found no text to read!"
            }

            // hide popup
            dialog.style.display = 'none'
        }

        reader.style.display = "block"
    },

    prepareReadingWindow: function() {
        var reader = document.createElement("div")
        reader.id = "PAGE_READER"
        reader.style.display = "none"
        reader.style.width = this.config.geometry.width
        reader.style.height = this.config.geometry.height
        reader.style.top = this.config.geometry.top
        reader.style.left = this.config.geometry.left
        reader.closeMyself = function() {
            this.style.display = "none"
        }

        var iframe = document.createElement("iframe")
        iframe.id = "PAGE_READER_IFRAME"
        iframe.scrolling = "no"
        reader.appendChild(iframe)

        document.getElementsByTagName('body')[0].appendChild(reader)
    },

    prepareMessageDialog: function() {
        var dialog = document.createElement("div")
        dialog.id = "PAGE_READER_DIALOG"
        dialog.className = "modal fade"
        dialog.style.display = "none"

        var div = document.createElement("div")
        div.className = "modal-dialog modal-sm"
        dialog.appendChild(div)

        var modal_content = document.createElement("div")
        modal_content.className = "modal-content"
        div.appendChild(modal_content)

        var modal_body = document.createElement("div")
        modal_body.className = "modal-body"
        modal_content.appendChild(modal_body)

        var p = document.createElement("p")
        p.id = "PAGE_READER_DIALOG_MSG"
        modal_body.appendChild(p)

        var loader = document.createElement("div")
        loader.className = "loader"
        modal_body.appendChild(loader)

        document.getElementsByTagName('body')[0].appendChild(dialog)
    },

    closeWindow: function() {
        if(this.timeout) clearTimeout(this.timeout)
        var reader = document.getElementById("PAGE_READER")
        reader.closeMyself()
        var iframe = document.getElementById("PAGE_READER_IFRAME")
        iframe.src = null
        iframe.onload = null
        this.reset()
    },

    /*
     * parseSentences
     *
     * Search 'doc' for tags of type 'tagname'.  For each matching node,
     * split into sentences and wrap each sentence in <span> nodes of class
     * 'MMM-wrapped-text'
     */
    parseSentences: function(doc, tagname="p") {
        var nodes = doc.getElementsByTagName(tagname)
        if(!nodes) {
            this.log("No nodes of type: " + tagname)
            return
        }

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

        this.log(`Parsed ${count} sentences from tag type '${tagname}'`)
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
        var iframe = document.getElementById("PAGE_READER_IFRAME")
        iframe.contentWindow.scrollTo(0, pos.y)

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
