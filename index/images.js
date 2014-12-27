var util = require('util');

module.exports = function(config, redis, logger) {

  return {

    repoImagesGet: function (req, res, next) { 
      if (!req.params.namespace)
        req.params.namespace = 'library';

      redis.get(redis.key('images', req.params.namespace, req.params.repo), function(err, images) {
        if (err && err.status != '404') {
          logger.error({err: err, function: "repoImagesGet"});
          res.send(500, err);
          return next();
        }
        
        if (err && err.status == '404') {
          images = [];
        }

        logger.debug({namespace: req.params.namespace, repo: req.params.repo}, 'Get Images');

        var key_count = 0;
        var keys = null;

        redis.createKeyStream({
          gte: redis.key('tokens', req.token_auth.token, 'images'),
          lte: redis.key('tokens', req.token_auth.token, 'images') + '\xFF'
        })
        .on('error', function(err) {
          logger.error({err: err});
          res.send(500, err);
          return next();
        })
        .on('data', function(key) {
          console.log('KEKKKKKEKKEKEKKEKE', key)
          keys = key;
          ++key_count;
        })
        .on('end', function() {
          if (key_count == 1000) {
            redis.del(keys, function(err, success) {
              if (err) {
                logger.error({err: err, function: "repoImagesGet"});
                res.send(500, err);
                return next();
              }
              
              redis.expire(redis.key('tokens', req.token_auth.token), 60, function(err, success2) {
                if (err) {
                  logger.error({err: err, function: "repoImagesGet"});
                  res.send(500, err);
                  return next();
                }

                res.send(200, images);
                return next();
              })
            })
          }
          else {
            redis.expire(redis.key('tokens', req.token_auth.token), 60 * 1000, function(err) {
              next.ifError(err);

              res.send(200, images)
              return next();
            })
          }
        });
      });
    },

    repoImagesPut: function (req, res, next) {
      if (!req.params.namespace)
        req.params.namespace = 'library';

      var repo_key = redis.key('images', req.params.namespace, req.params.repo);

      redis.exists(repo_key, function(err, exists) {
        if (err) {
          logger.error({err: err});
          res.send(500, err);
          return next();
        }
        
        if (!exists) {
          redis.set(repo_key, [], function(err, success) {
            if (err) {
              logger.error({err: err});
              res.send(500, err);
              return next();
            }
            
            res.send(204);
            return next();
          })
        }
        else {
          res.send(204);
          return next();
        }
      });
    },
    
    repoImagesLayerAccess: function (req, res, next) {
      var key = redis.key('tokens', req.token_auth.token, 'images', req.params.image);
      redis.exists(key, function(err, exists) {
        if (err) {
          res.send(500, {error: err, access: false})
          return next();
        }

        if (exists == true) {
          redis.del(key);
          res.send(200, {access: true});
          return next();
        }
        else {
          redis.del(key);
          res.send(200, {access: false})
          return next();
        }
      });
    }
    
  } // end return

}
