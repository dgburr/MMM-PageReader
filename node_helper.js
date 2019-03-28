/*
 * File:        node_helper.js
 * Created:     24/03/2019 by Daniel Burr <dburr@dburr.net>
 * Description: Node helper for MMM-PageReader
 * License:     GNU Public License, version 3
 */

const request = require("request")
const bodyParser = require("body-parser")
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const URL = require('url').URL

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
    socketNotificationReceived: function(noti, payload) {
        switch(noti) {
            case "PROXY_URL":
                this.requestURL(payload)
                break
            case "LOG":
                this.log(payload)
                break
        }
    },

    requestURL: function(url) {
        request({url: url, method: "GET"}, (error, response, body)=> {
            if(error) {
                this.log("Cannot open URL: " + url)
            } else {
                var url_obj = new URL(url)
                var jsdom = new JSDOM(body)
                // change any relative URLs in <img> tags to absolute
                jsdom.window.document.querySelectorAll('img').forEach(img => {
                    if(img.src && img.src.length > 0 && img.src[0] == '/') {
                        img.src = url_obj.origin + img.src
                    }
                })
                this.result = jsdom.serialize()
                this.proxyServe(url)
            }
        })
    },

    proxyServe: function(url) {
        this.expressApp.use(bodyParser.json())
        this.expressApp.use(bodyParser.urlencoded({extended: true}))
        this.expressApp.get("/proxied_url", (req, res) => {
            var html = this.result
            res.status(200).send(html)
        })
        this.sendSocketNotification("PROXY", { orig: url, proxy: "/proxied_url" })
    },

    log: function(msg) {
        console.log("[MMM-PageReader] " + msg)
    },

})
