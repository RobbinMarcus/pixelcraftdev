// Caching

var cacheName = "LearnGameProgramming";
var cacheLock = {};

var databaseName = "LearnGameProgramming";
var databaseLock = {};

function cacheValueLocalStorage(name, value)
{
    if (typeof(Storage) == "undefined") { return; }
    localStorage.setItem(name, value);
}

function fromLocalStorage(name)
{
    if (typeof(Storage) == "undefined") { return; }
    return localStorage.getItem(name);
}

async function cacheResponse(url)
{
    // Enable lock to avoid fetching multiple times
    if (cacheLock[url])
    {
        await cacheLock[url].promise;
        return loadCached(url);
    }
    cacheLock[url] = new AsyncLock();
    cacheLock[url].enable();

    var cache = await caches.open(cacheName);
    var response = await fetch(url);
    if (response === undefined)
    {
        console.log("Failed to cache url: " + url);
        return response;
    }
    cache.put(url, response.clone());

    cacheLock[url].disable();
    return response;
}

async function loadCached(url)
{
    if (location.protocol === 'https:')
    {
        var cache = await caches.open(cacheName);
        var response = await cache.match(url);
        if (response === undefined)
        {
            return cacheResponse(url);
        }
        return response;
    }

    return await fetch(url);
}

// Locks

class AsyncLock {
    constructor () {
        this.disable = () => {}
        this.promise = Promise.resolve()
    }

    enable () {
        this.promise = new Promise(resolve => this.disable = resolve)
    }
}
