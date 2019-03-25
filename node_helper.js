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
                this.detail = body
                this.proxyServe()
            }
        })
    },

    proxyServe: function() {
        this.expressApp.use(bodyParser.json())
        this.expressApp.use(bodyParser.urlencoded({extended: true}))
        this.expressApp.get("/proxied_url", (req, res) => {
            var html = this.detail
            res.status(200).send(html)
        })
        this.sendSocketNotification("PROXIED_URL", "/proxied_url")
    },

    log: function(msg) {
        console.log("[MMM-PageReader] " + msg)
    },

})
