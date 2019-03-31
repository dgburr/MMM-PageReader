/*
 * File:        node_helper.js
 * Created:     24/03/2019 by Daniel Burr <dburr@dburr.net>
 * Description: Node helper for MMM-PageReader
 * License:     GNU Public License, version 3
 */

const request = require("request")
const bodyParser = require("body-parser")

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
    start: function() {
        console.log(`Starting node helper for: ${this.name}`)
    },

    socketNotificationReceived: function(notification, payload) {
        switch(notification) {
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
                this.sendSocketNotification("PROXY", { orig: url })
            } else {
                this.result = body
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
