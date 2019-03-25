/*
 * File:        MMM-PageReader.js
 * Created:     24/03/2019 by Daniel Burr <dburr@dburr.net>
 * Description: Main file for MMM-PageReader
 * License:     GNU Public License, version 3
 */

Module.register("MMM-PageReader", {
    defaults: {
        highlight: 'background-color:red;', // CSS to be applied to highlighted sentences
        width: "100%",
        height: "100%",
        top: "0",
        left: "0",
        timeout: 1000, // amount of time to wait before moving to the next sentence.  If set to 0, waits for a PAGE_READ_NEXT event
        notification: null, // if defined, a notification with this name (and payload containing text) will be sent for each sentence
    },

    getStyles: function() {
        return ['MMM-PageReader.css']
    },

   start: function() {
        this.current_span_index = 0
        this.spans = null
    },

    notificationReceived: function(noti, payload, sender) {
        switch(noti) {
            case "DOM_OBJECTS_CREATED":
                this.prepareWindow()
                break
            case "PAGE_READ_LOAD":
                this.sendSocketNotification("PROXY_URL", payload)
                break
            case "PAGE_READ_NEXT":
                this.nextSentence()
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
            var style = document.createElement('style')
            style.type = 'text/css'
            style.innerHTML = 'span.highlight {' + self.config.highlight + '}'
            doc.head.appendChild(style)
            self.parseSentences(doc)
            self.current_span_index = 0
            self.spans = doc.querySelectorAll('span.MMM-wrapped-text')
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
        var reader = document.getElementById("PAGE_READER")
        reader.closeMyself()
        var iframe = document.getElementById("PAGE_READER_IFRAME")
        iframe.src = null
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
            // Split at sentence boundaries
            var arr = paragraphs[i].textContent.split(".")
            // Generate spans for each sentence
            for(var j = 0; j < arr.length; j++) {
                if(arr[j].length > 0) {
                    count++
                    arr[j] = "<span class='MMM-wrapped-text'>" + arr[j] + "</span>"
                }
            }
            paragraphs[i].innerHTML = arr.join(".")
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
            this.sendNotification(this.config.notification, this.spans[this.current_span_index].innerHTML)
        }

        this.spans[this.current_span_index].setAttribute("class", "highlight") 
        var pos = this.getPositionOfElement(this.spans[this.current_span_index])
        var iframe = document.getElementById("PAGE_READER_IFRAME")
        iframe.contentWindow.scrollTo(0, pos.y)

        if(this.config.timeout > 0) {
            setTimeout(()=>{
                this.nextSentence()
            }, this.config.timeout)
        }
    },

    nextSentence: function() {
        this.spans[this.current_span_index].removeAttribute("class")
        this.current_span_index++
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
