import * as keccakHash from 'keccak';
import * as uuidBase62 from 'uuid-base62';
import * as jwt from "jsonwebtoken";
import * as passport from "passport";

import { NextFunction, Request, Response, Router } from "express";
import { BaseRoute } from "./baseRoute";
import { IPolicy, IPolicyModel, policySchema } from "../../shared/models/policy";
import { CORE_DATA_MODEL } from '../../shared/models/model';





/**
 * All JWT-requiring (secured) routes
 *
 * @class SecuredRoute
 */
export class SecuredRoute extends BaseRoute {



    /**
     * Constructor
     *
     * @class SecuredRoute
     * @constructor
     */
    constructor(_dm: CORE_DATA_MODEL, _policyModel: any, _policyHolderModel: any) {
        super(_dm, _policyModel, _policyHolderModel);
    }
  
  
  
    /**
     * 
     *
     * @class SecuredRoute
     * @method getPolicy
     * @param req {Request} The express Request object.
     * @param res {Response} The express Response object.
     * @next {NextFunction} Execute the next method.
     */
    public getPolicy(req: Request, res: Response, next: NextFunction) {
        let global_this = this;
        // Get the ObjectID for the PolicyHolder
        this.policyHolderModel.findOne({policyHolderID: req.body.policyHolderID})
            .exec(function(phError, policyHolder){
                if (phError) {
                    console.log('Error: Failed to communicate with the DB. ErrorMessage=' + phError.message);
                    res.status(400);
                    res.send({error: 'Failed to communicate with the DB. ErrorMessage=' + phError.message});
                    return;
                }

                if (policyHolder == null){
                    console.log('Error: Failed to locate the requested PolicyHolder. PolicyHolderID=' + req.body.policyHolderID);
                    res.status(404);
                    res.send({error: 'Failed to locate the requested PolicyHolder'});
                    return;
                }
                
                global_this.policyModel.findOne({ policyHolder: policyHolder._id })  
                    .exec(function(err, policy){
                        if (err) {
                            console.log('Error: Failed to communicate with the DB. ErrorMessage=' + err.message);
                            res.status(400);
                            res.send({error: 'Failed to communicate with the DB. ErrorMessage=' + err.message});
                            return;
                        }

                        if (policy == null){
                            console.log('Error: Failed to locate the requested Policy. PolicyHolderID=' + req.body.policyHolderID);
                            res.status(404);
                            res.send({error: 'Failed to locate the requested Policy'});
                            return;
                        }

                        res.send(policy);
                    });
            });
    }
  
  
    /**
     * 
     *
     * @class SecuredRoute
     * @method setEthereumAddressForPolicy
     * @param req {Request} The express Request object.
     * @param res {Response} The express Response object.
     * @next {NextFunction} Execute the next method.
     */
    public setEthereumAddressForPolicy(req: Request, res: Response, next: NextFunction) {

        // Make sure the request is valid
        try{
            if (req.body.policyID == null || req.body.policyID.trim().length == 0){
                console.log("Error: bad policyID");
                res.status(400);
                res.send({error: 'PolicyID is blank'});
                return;
            }

            if (req.body.ethereumAddress == null || !this.isAddress(req.body.ethereumAddress)){
                console.log("Error: bad Ethereum Address");
                res.status(400);
                res.send({error: 'Ethereum Address does not meet formatting requirements or did not pass checksum validation'});
                return;
            }
        }catch(validationError){
            console.log('Error: failed while validating inputs. ErrorMessage=' + validationError.message);
            res.status(400);
            res.send({error: 'Failed while validating inputs.'});
            return;
        }

        let Policy = this.policyModel;
        Policy.findOne({"policyID":req.body.policyID}, function(err, policy){
            if (err) {
                console.log('Error: Failed to communicate with the DB. ErrorMessage=' + err.message);
                res.status(400);
                res.send({error: 'Failed to communicate with the DB. ErrorMessage=' + err.message});
                return;
            }

            if (policy == null){
                console.log('Error: Failed to locate the requested Policy. PolicyID=' + req.body.policyID);
                res.status(404);
                res.send({error: 'Failed to locate the requested Policy'});
                return;
            }

            policy.ethereumAddress = req.body.ethereumAddress;
            Policy.update({_id : policy.id}, policy, function(err) {
                if (err) {
                    console.log("not updated!");
                    res.status(400);      
                    res.send();
                }

                console.log("updated!");
                res.send({status: 'ok'});
            });
        });
    }


    public loginFacebookUser(req: any, res: Response, next: NextFunction) {
        console.log('Logging facebook user in');
        const _facebookID = req.user.facebook.id;
        const _policyHolderID = req.user.policyHolderID;
        const _policyHolderName = req.user.facebook.name;
        const _policyHolderEmail = req.user.facebook.email;

        let global_this = this;
        // Get the ObjectID for the PolicyHolder
        this.policyHolderModel.findOne({policyHolderID: req.user.policyHolderID})
            .exec(function(phError, policyHolder){
                if (phError || policyHolder == null) {
                    console.log('No policy for this facebook user');
                    res.send({ hasPolicy: false, accountID: _facebookID, policyHolderID: _policyHolderID, policyHolderName: _policyHolderName, email: _policyHolderEmail });
                    return;
                }
                
                global_this.policyModel.findOne({ policyHolder: policyHolder._id })  
                    .exec(function(err, policy){
                        if (err || policy == null || policy.length == 0) {
                            console.log('No policy for this facebook user');
                            res.send({ hasPolicy: false, accountID: _facebookID, policyHolderID: _policyHolderID, policyHolderName: _policyHolderName, email: _policyHolderEmail });
                            return;
                        } else {
                            const jwt = global_this.createJWT(_policyHolderName, _policyHolderID, policy.coveredCity.name);
                            console.log('Facebook user already has a policy');
                            res.setHeader('Authorization', jwt);
                            res.send({ hasPolicy: true });
                            return;
                        }
                    });
            });
    }


    /**
     * Checks if the given string is an Ethereum address
     *
     * @method isAddress
     * @param {String} address the given HEX adress
     * @return {Boolean}
    */
    private isAddress(address: string) {
        if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
            // check if it has the basic requirements of an address
            return false;
        } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
            // If it's all small caps or all all caps, return true
            return true;
        } else {
            // Otherwise check each case
            return this.isChecksumAddress(address);
        }
    };

    /**
    * Checks if the given string is a checksummed address
    *
    * @method isChecksumAddress
    * @param {String} address the given HEX adress
    * @return {Boolean}
    */
    private isChecksumAddress(address: string) {
        // Check each case
        address = address.replace('0x','');
        var addressHash = keccakHash('keccak256').update(address.toLowerCase()).digest('hex');
        for (var i = 0; i < 40; i++ ) {
            // the nth letter should be uppercase if the nth digit of casemap is 1
            if ((parseInt(addressHash[i], 16) > 7 && address[i].toUpperCase() !== address[i]) || (parseInt(addressHash[i], 16) <= 7 && address[i].toLowerCase() !== address[i])) {
                return false;
            }
        }
        return true;
    };
}