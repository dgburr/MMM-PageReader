# MMM-PageReader

## Overview
`MMM-PageReader` is a MagicMirror² Module for reading web content.  It loads a specified URL into a HTML window, highlights each sentence in turn and then closes the window.

`MMM-PageReader` can be used for two different use cases:

1. Automatic (timed) scrolling
2. Event-driven scrolling (useful for interacting with a Text-to-Speech engine)

## Configuration
Default configuration:

```javascript
{
    module: "MMM-PageReader",
    config: {
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
    }
}
```

### Automatic (timed) scrolling

```javascript
{
    module: "MMM-PageReader",
    config: {
        timeout: 1000,
        notification: null,
    }
}
```

### Event-driven scrolling

```javascript
{
    module: "MMM-PageReader",
    config: {
        highlight: 'background-color:yellow',
        timeout: 0,
        notification: "PAGE_READER_SENTENCE",
    }
}
```

## Notifications
`MMM-PageReader` listens for the following notifications:

* `PAGE_READER_LOAD`: payload specifies a URL to load and display.
* `PAGE_READER_NEXT`: highlight the next sentence or close the window if the last sentence is currently being displayed.  Optional payload specifies number of sentences to skip forwards.
* `PAGE_READER_PREVIOUS`: highlight the previous sentence.  Optional payload specifies the number of sentences to skip backwards.
* `PAGE_READER_STOP`: close the window if currently displayed.
* `PAGE_READER_PAUSE`: pause reading.
* `PAGE_READER_RESUME`: resume reading

If the `notification` option is set in the configuration, then `MMM-PageReader` will send a notification of this type for each sentence, with the payload corresponding to the sentence text.

## HTML Transformation
This functionality is useful in case the source URL shows some kind of popup which you wish to hide.  For example, to higde the element 'annoying-popup':

```javascript
config: {
    html: {
        transform: (url, doc) => {
            doc.getElementsByClassName("annoying-popup")[0].style.display = 'none'
        }
    }
}
```

## Regions
Some websites contain elements which you may wish to skip during reading.  The `regions` parameter can be used to restrict sentence highlighting to specific elements in the DOM.  This parameter allows the user to specify a function which returns a list of criteria in the format accepted by `querySelectorAll()`.

For example, to limit highlighting of pages from 'www.example.com' to the sentences contained within a 'div' element named 'content':

```javascript
config: {
    html: {
        regions: (url) => {
            if(url.indexOf("www.example.com") != -1) {
                return [ 'div[class^="content"]' ]
            }
            return null
        }
    }
}
```
Note that returning `null` means that no restrictions will be applied, i.e. all sentences will be highlighted.
