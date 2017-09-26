# Newman Reporter for Logspout Ingestion

This reporter will convert each test event into a line of JSON that has proper notation for ingestion by 
Logspout into ElasticSearch.   

If there are errors (exceptions in the Newman run, not test failures), they will also be represented.  See table for full description of values. 
Each test as executed will print to stdout for consumption by logspout.

## Values 

| Key | Value  |  
|:-|:-|
| `collection`  |  name of Postman/ Newman Collection  |  
| `test_name` | Name of Test Executed  |
| `http.request.method` | Request verb |
| `http.request.host` | hostname | 
| `http.request.uri.keyword` | url path |
| `execution_time` | Timestamp (seconds from Epoch) of when test was executed |
| `http.response.status` | Status code | 
| `run_time` | time (ms) the request took |
| `size` | size (bytes) of response |
| `test_passed` | if all assertions of test passed (true/false) |
| `error` | true if there was an exception in the test run |
| `error_object` | details of exception | 




### Ex: Passed Test JSON 
```json
    {
      "collection": " Health v2.0",
      "test_name": "Product Host Health",
      "http.request.method": "GET",
      "http.request.host": "typical-hostname.com",
      "http.request.uri.keyword": "/admin/health",
      "execution_time": "1506383333",
      "http.response.status": 200,
      "run_time": 367,
      "size": 430,
      "test_passed": true
    }
```

### Ex: Exception in Test Run 

```json 
    {
      "collection": "Health v2.0",
      "test_name": "Proxy Health",
      "http.request.method": "GET",
      "http.request.host": "another-typical-hostname.com",
      "http.request.uri.keyword": "/admin/health",
      "execution_time": "1506383575",
      "error": true,
      "error_object": {
        "type": "Error",
        "name": "Error",
        "message": "Invalid Chai property: _postman_propertyIsList",
        "checksum": "cededb2b7e09ddc1966754c80c85e582",
        "id": "a2b9b893-b47b-4b5e-b0c6-86bda21584af",
        "timestamp": 1506383575532,
        "stacktrace": []
      },
      "test_passed": false
    }
```