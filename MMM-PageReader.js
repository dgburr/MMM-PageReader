/*
 * File:        MMM-PageReader.js
 * Created:     24/03/2019 by Daniel Burr <dburr@dburr.net>
 * Description: Main file for MMM-PageReader
 * License:     GNU Public License, version 3
 */

Module.register("MMM-PageReader", {
    defaults: {
        highlight: 'background-color:red;', // CSS to be applied to highlighted sentences
        width: "100%",  // width of page reading window (px or %)
        height: "100%", // height of page reading window (px or %)
        left: "0",      // X position of page reading window (px)
        top: "0",       // Y position of page reading window (px)
        timeout: 1000,  // amount of time (in ms) to wait before moving to the next sentence.  If set to 0, waits for a PAGE_READER_NEXT event
        notification: null, // if defined, a notification with this name (and payload containing text) will be sent for each sentence
        transform: (url, doc) => { // custom HTML transformation rule to be applied after loading
        },
    },

    getStyles: function() {
        return ['MMM-PageReader.css']
    },

   start: function() {
        this.paused = false
        this.current_span_index = 0
        this.spans = null
        this.timeout = null
    },

    notificationReceived: function(notification, payload, sender) {
        switch(notification) {
            case "DOM_OBJECTS_CREATED":
                this.prepareWindow()
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
            this.displayWindow(payload)
        }
    },

    displayWindow: function(url) {
        var self = this

        var iframe = document.getElementById("PAGE_READER_IFRAME")
        iframe.src = url
        iframe.onload = function() {
            var doc = iframe.contentDocument || iframe.contentWindow.document

            // add style to apply as highlight
            var style = document.createElement('style')
            style.type = 'text/css'
            style.innerHTML = 'span.highlight {' + self.config.highlight + '}'
            doc.head.appendChild(style)

            // execute (optional) HTML transformation
            if(self.config.transform && typeof self.config.transform == "function") {
                try {
                    self.config.transform(url, doc)
                } catch(e) {
                    this.log("Transform failed: " + e)
                }
            }

            // wrap sentences in spans of class 'MMM-wrapped-text'
            self.parseSentences(doc)
            // get results of parse
            self.current_span_index = 0
            self.spans = doc.querySelectorAll('span.MMM-wrapped-text')
            // start highlighting
            self.highlightSentence()
        }
        var reader = document.getElementById("PAGE_READER")
        reader.style.display = "block"
    },

    prepareWindow: function() {
        var reader = document.createElement("div")
        reader.id = "PAGE_READER"
        reader.style.display = "none"
        reader.style.width = this.config.width
        reader.style.height = this.config.height
        reader.style.top = this.config.top
        reader.style.left = this.config.left
        reader.closeMyself = function() {
            this.style.display = "none"
        }
        var iframe = document.createElement("iframe")
        iframe.id = "PAGE_READER_IFRAME"
        iframe.scrolling = "no"

        reader.appendChild(iframe)
        document.getElementsByTagName('body')[0].appendChild(reader)
    },

    closeWindow: function() {
        if(this.timeout) clearTimeout(this.timeout)
        var reader = document.getElementById("PAGE_READER")
        reader.closeMyself()
        var iframe = document.getElementById("PAGE_READER_IFRAME")
        iframe.src = null
        iframe.onload = null
        this.start()
    },

    /*
     * parseSentences
     *
     * Search for paragraphs (<p> nodes).  For each paragraph, split into
     * sentences and wrap in <span> nodes of class 'MMM-wrapped-text'
     */
    parseSentences: function(doc) {
        var paragraphs = doc.getElementsByTagName("p")
        if(!paragraphs) {
            this.log("No paragraphs")
            return
        }
        var count = 0
        for(var i = 0; i < paragraphs.length; i++) {
            var text = paragraphs[i].textContent.trim()
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

            paragraphs[i].innerHTML = result
        }

        this.log("Parsed " + count + " sentences")
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
            text = text.replace("&nbsp;", ' ')
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

    log: function(msg) {
        this.sendSocketNotification("LOG", msg)
    }

})
