//currently set up simplistically for individual function reference via `global` object.
//todo: include as library for utils.method() access.

//combine objects, arrays of, and/or a combination into single array of objects
global.combine = function(...arrays){
    return _.reduce(arrays, (combination, array)=>{
        if( !_.isArray(array) ) array = [array];
        return combination = combination.concat(array);
    }, []
    ).filter(Boolean); //remove false, nulls and undefined elements
}

//executes a series of callback search queries returning first valid result, does not execute subsequent callbacks
global.try_in_sequence = function(setOfCallbacks, opt_context = undefined){
    return _.reduce(setOfCallbacks, function(results, callback, id){ 
        if( results === false || _.isEmpty(results) || results === null || _.isUndefined(results) ) results = _.isUndefined(opt_context) ? callback() : callback.bind(opt_context)(); //change callback context if specified
        //debug: if( opt_context && opt_context.room && opt_context.room.myName() === 'SW' ) console.log(id, results, '|', opt_context)
        return results //^only updated until callback() returns something valid
    }, false)
}
//parent variant of try_in_sequence function
//todo: amalgamate get_closest_ID_for_first_of() + try_in_sequence()
global.get_closest_ID_for_first_of = function(setOfCallbacks, context = undefined){
    const bestOption = context.getClosest( 
        try_in_sequence(setOfCallbacks, context) 
    )                            
    return bestOption && bestOption.id
}

//alias for getObjectById
global.gObj = function(id){ return Game.getObjectById(id) }

//returns the first non empty element in the array
global.first_valid_option = function(arr){
    var rc = false;
    _.each(arr, function(el){ if( !_.isEmpty(el) ){ rc = el; return false; } })
    return _.isArray(rc) && rc.length === 1 ? rc[0] : rc;
}

//recasts a (memory-recalled) JSON position object into a RoomPosition
global.jsonPos2Obj = function(jsonPos){ return new RoomPosition(jsonPos.x, jsonPos.y, jsonPos.roomName) }

//for reporting, debugging or visualization labels: simplify larges numbers for legibility
global.simpNum = function(num){
    if( num >= 1000 && num < 100000 ) return _.round(num/1000,1)+'k'
    if( num > 100000 && num < 100000000 ) return _.round(num/1000000,1)+'M'
    if( num >= 100000000 && num < 100000000000 ) return _.round(num/1000,1)+'B'
    return num;
}

//report on array composition, eg; part count for `body` array
global.summarize = function(arr){
    var counts = {};
    _.each(arr, function(i){ counts[i] = counts[i] ? counts[i]+1 : 1 });
    return JSON.stringify(counts)
}

//calculate spawn energy needed for a given array of body parts
global.creepCost = function(body){
    if( _.isEmpty(body) || !_.isArray(body) ) return 0;
    if( _.isObject(body[0]) && body[0].type ) body = _.pluck(body, 'type') //convert creep.body to type array
    return _.reduce(body, function(result,i){
        return result + BODYPART_COST[i]
    }, 0)
}

//Get value at path if exists, else set to value, with lodash
global.getOrSet = function(object, path, value){
  const got = _.get(object, path)
  if (got != null) return got
  _.set(object, path, value)
  return value
}

//convert native method return codes into human-readable for debugging
global.decodeError = function(error){
    return {
        [OK]: 'OK',
        [ERR_NOT_OWNER]: 'ERR_NOT_OWNER',
        [ERR_NO_PATH]: 'ERR_NO_PATH',
        [ERR_NAME_EXISTS]: 'ERR_NAME_EXISTS',
        [ERR_BUSY]: 'ERR_BUSY',
        [ERR_NOT_FOUND]: 'ERR_NOT_FOUND',
        [ERR_NOT_ENOUGH_ENERGY]: 'ERR_NOT_ENOUGH_ENERGY/RESOURCES/EXTENSIONS',
        [ERR_INVALID_TARGET]: 'ERR_INVALID_TARGET',
        [ERR_FULL]: 'ERR_FULL',
        [ERR_NOT_IN_RANGE]: 'ERR_NOT_IN_RANGE',
        [ERR_INVALID_ARGS]: 'ERR_INVALID_ARGS',
        [ERR_TIRED]: 'ERR_TIRED',
        [ERR_NO_BODYPART]: 'ERR_NO_BODYPART',
        [ERR_RCL_NOT_ENOUGH]: 'ERR_RCL_NOT_ENOUGH',
        [ERR_GCL_NOT_ENOUGH]: 'ERR_GCL_NOT_ENOUGH'
    }[error];
}

//return all flag objects which have a name starting with `build`
global.flagStartsWith = (string, opt_roomName = undefined )=> { 
    let results = _.filter(Game.flags, flag=> flag.name.includes(string) && (_.isUndefined(opt_roomName) || flag.pos.roomName === opt_roomName) )
    return !_.isEmpty(results) && results;
};

//converts array of ids to array of currently existing objects
global.deserializeObjs = function(arr){ return _.filter(_.map(arr, id=> gObj(id)), obj=> _.isObject(obj) ) }
//converts array of objects to array of ids
global.serializeObjs = function(arr){ return _.pluck(arr, 'id') }
//serialize values, flat or nested hashes;
global.serializeDeep = function(val){ //assumes val contains: non objects, or array of objects with id, or hash of array of objects with id
    if( !_.isObject(val) ) return val;
    else if( _.isArray(val) ){
        let arr = val.filter(Boolean) //remove: null, false, undefined
        if( _.isEmpty(arr) ) return undefined;
        return _.pluck(arr, 'id')
    }
    //else: hash of array of objects with id;
    return _.reduce(val, (results, groupedArray, key)=>{
        let arr = groupedArray.filter(Boolean) //remove: null, false, undefined
        if( !_.isEmpty(arr) ) results[key] = _.pluck(arr, 'id')
        return results;
    }, {})
}
global.deserializeDeep = function(val){
    if( !_.isObject(val) ) return val;
    else if( _.isArray(val) ){
        let objs = _.map(val, obj => gObj(obj)).filter(Boolean) //convert to game objs, remove null/expired
        return !_.isEmpty(objs) && objs
    }
    //else: hash of array of ids;
    return _.reduce(val, (results, groupedArray, key)=>{
        let objs = _.map(groupedArray, obj=> gObj(obj)).filter(Boolean) //convert to game objs, remove null/expired
        if( !_.isEmpty(objs) ) results[key] = objs
        return results;
    }, {})
}

//compare CPU costs for two+ functions, eg; console usage: benchmark([function(){ code1 }, function(){ alt_to_code1 }, ...]);
global.benchmark = function(arr, iter=1000){
    let i, j, len = arr.length;
    let start, used;
    let results = _.map(arr, (fn)=> ({ fn: fn.toString(), time: 0, avg: 0 }));
    for( j = 0; j < iter; j++ ){
        for( i = 0; i < len; i++ ){
            start = Game.cpu.getUsed();
            results[i].rtn = arr[i]();
            used = Game.cpu.getUsed() - start;
            //if( i>0 && results[i].rtn !== results[0].rtn ) throw new Error('Results are not the same!');
            results[i].time += used;
        }
    }
    console.log(`Benchmark results, ${iter} loop(s): `);
    _.each(results, (res)=> {
        res.avg = _.round(res.time / iter,3);
        res.time = _.round(res.time,3);
        console.log(`Time: ${res.time}, Avg: ${res.avg}; ${res.fn}`);
    });
}

//captures CPU metrics to a Memory path and tracks average. 
//Accumulates explicit optValue if provided, otherwise independantly accumulates CPU usage *since* last time metric() was run.
/*usage
  metric('init')
  { code for harvester }
  metric('role.harvester')
  { code for upgrader }
  metric('temp.upgrader_move_cost', track_separately_upgrader_move_cost)
  metric('role.upgrader')
  console.log('Library parse cost:', Memory.metrics.init)
  console.log('Upgrader CPU:', Memory.metrics.role.upgrader, 'of which', Memory.metrics.temp.upgrader_move_cost, 'is for moving')
*/
function metric(keyPath, optValue = false){
    let gameTick = getOrSet(Memory, 'metrics.gameTick', Game.time)
    let lastCPU = getOrSet(Memory, 'metrics.lastCPU', 0)
    if( gameTick !== Game.time ){
        lastCPU = 0
        _.assign(Memory.metrics, { 'lastCPU': 0, 'gameTick': Game.time }) //reset accumulator beginning of every tick;
    }
    
    let metric = _.get(Memory, 'metrics.'+keyPath, {'start': Game.time, 'tick': Game.time, 'tot': 0, 'avg': 0, 'val': []}) //get current or default
    if( metric.tick !== Game.time ){ //beginning of tick for this keyPath
        metric.tot += _.sum(metric.val) //calculate cumulative total from previous tick
        _.assign(metric, { 'val': [], 'tick': Game.time, 'avg': _.round(metric.tot / (Game.time - metric.start)) }) //fresh start for cumulative counts for this tick
    }
    let newMeasurement = optValue || Game.cpu.getUsed() - lastCPU
    metric.val.push(newMeasurement) //add new measurement
    if( !optValue )  Memory.metrics.lastCPU = Game.cpu.getUsed() //update for next benchmark comparison
    _.set(Memory, 'metrics.'+keyPath, metric) //save
}
