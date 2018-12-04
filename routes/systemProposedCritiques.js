/** Generate corresponding critiques by systems using Apriori algorithms and some utility functions
 * @param {object} user a specific user object containing userId, user preference data and weight data for each attribute
 * @param {object} itemData item datasets used to generate corresponding critique
 * @param {object} topRecItem the information of the last recommended item {itemId:'fff','attribut':'fd'....}
 * @param {object} nominalAttributes a list of names of nominalAttributes
 * @param {object} numericalAttributes a list of names of numericalAttributes
 * @param {int} numberOfCritiques the number of critiques required 
 * @example systemProposedCritiques(...)
 * @returns {object} 
 * 
 */
const fi = require('./frequent-itemset-new');
//const fi = require('./relim_frequent_itemsets');
const _ = require('lodash');


// ------------------------------------------------------------------
// Value function
// ------------------------------------------------------------------
function nearIsBetter_ValueFunction(user, item, itemData, attribute)
{
	/*
	sortItemData = _.orderBy(itemData, [attribute], ['desc']); // time-comsuming
	let maxAttrV = sortItemData[0][attribute];
	let minAttrV = itemData[itemData.length-1][attribute];

	let userAttrV = user.preferenceData[attribute];
	let itemAttrV = itemData[item][attribute];
	return (1-Math.abs(itemAttrV - userAttrV )/(maxAttrV - minAttrV));
	*/

	let maxAttrV = user.preferenceData[attribute] + user.preferenceData_variance[attribute] ;
	let minAttrV = user.preferenceData[attribute] - user.preferenceData_variance[attribute] ;
	let itemAttrV = itemData[item][attribute];
	if (itemAttrV <= maxAttrV && itemAttrV >= minAttrV)
	{
		return 1;
	}
	else{
		return 0;
	}
}

function nominalAttribute_ValueFunction(user, item , itemData, attribute)
{
	if (user.preferenceData[attribute].includes(itemData[item][attribute]))
	{
		return 1;
	}
	else{
		
		return 0;
	}
}

// ------------------------------------------------------------------
// Multi-attribute Utility Theory (MAUT) : Get Utility for each items
// ------------------------------------------------------------------
function MAUT(user, itemData, numericalAttributes, nominalAttributes)
{

	//console.log("-----------         MAUT          --------------");

	var utility = [];
	let preferenceValue = [];
	let attribute = '';
	let value = 0;

	for (let i = 0; i < itemData.length; i++){
		
		preferenceValue = {};
		let itemID = itemData[i]['id'];
		// Step 1: Obtain the value for each attributes
		// [1] Nominal Attributes
		
		for (let attribute of nominalAttributes)
		{	
			value = nominalAttribute_ValueFunction(user,i, itemData, attribute);		
			preferenceValue[attribute] = value ;
		}
		// [2] Numerical Attributes
		for (let attribute of numericalAttributes)
		{
			value = nearIsBetter_ValueFunction(user,i, itemData, attribute);		
			preferenceValue[attribute] = value ;
		}
		//console.log(preferenceValue);
		
		// Step 2: calculate the utility
		let itemUtility = 0;
		for (let attribute of nominalAttributes)
		{
			itemUtility += preferenceValue[attribute] * user.attributeWeight[attribute];
		}
		for (let attribute of numericalAttributes)
		{
			itemUtility += preferenceValue[attribute] * user.attributeWeight[attribute];
		}

		utility[i]= {'itemID':itemID, 'utility':itemUtility};
		
	}
	return utility;
	
}


// ------------------------------------------------------------------
// Generate Critique Array
// ------------------------------------------------------------------ 

function getItemCritique(itemData, topRecItem, nominalAttributes, numericalAttributes){

    // construct item attribute pairs set (improved or compromised)
	let itemCritiqueArray = [];  //  store all attribute critique for each item in the form of array and used in Apriori Algorithms
	let itemCritiqueDict = [];  //  store all attribute critique for each item in the form of dictionary and used when selecting the favor critiques

	// obtain critique for each item by comparing with the top recommended items
	for (let i=0; i < itemData.length; i++){
		let item = itemData[i];
		let itemAttrV = '';
		let critiqueArray = [];  

		//  obtain critiques for nominal attributes
		for (let attribute of nominalAttributes)
		{
			itemAttrV = item[attribute];
			critiqueArray.push([attribute,itemAttrV].join('-'));
		}

		//  obtain critiques for numerical attributes
		for (let attribute of numericalAttributes)
		{
			itemAttrV = item[attribute];
			if(itemAttrV==topRecItem[attribute])
			{
				critiqueArray.push([attribute,'equal'].join('-'));
			}
			if(itemAttrV < topRecItem[attribute])
			{
				critiqueArray.push([attribute,'lower'].join('-'));
			}
			if(itemAttrV > topRecItem[attribute])
			{
				critiqueArray.push([attribute,'higher'].join('-'));
			}
		}

		itemCritiqueArray.push(critiqueArray);
		itemCritiqueDict[i]={'itemId':item['id'], 'critiques':critiqueArray};
    }
    return {'itemCritiqueArray':itemCritiqueArray,'itemCritiqueDict':itemCritiqueDict};
}


// ------------------------------------------------------------------
// Tradeoff Utility 
// ------------------------------------------------------------------
function computeTradeoffUtility (user, frequentCritiqueSet, itemCritiqueDict, utilityDict){
    
    let critiqueUtilityDict = [];
    let allCritique2ItemDict = [];
    for (let critique of frequentCritiqueSet)
	{
		// Obtain the set of products satisfy critique
		let critique2ItemSet = [];  // store the set of items that satisfy the specific critique
		let itemCritiques = [];
		for (let i = 0; i < itemCritiqueDict.length; i++)
		{	
			itemCritiques = itemCritiqueDict[i]['critiques'];
			let flag = 1;
			for (let c of critique)
			{
				if (!itemCritiques.includes(c))
				{
					flag = 0;	
				}
			}
			if (flag == 1)
			{
				critique2ItemSet.push({'id': itemCritiqueDict[i]['itemID'], 'utility': utilityDict[i]['utility']});
			}
		}
		//console.log(critique2ItemSet.length);
        
        //console.log("compute tradeoff utility for critiques");
	    let tradeoffUtility = 0;
	    let critiqueDict = [];
	
	    let tradeoff_improve = 0.75;
	    let tradeoff_compromise = 0.25;
	    let tradeoff = 0.5;
    	for (let c of critique)
	    {
		    let critique = c.split("-");
	    	// how to judge whether it is improved or compromised?? 

		    if(critique[1]=="higher")
		    {
		    	tradeoff = tradeoff_improve;
	    	}
	    	if(critique[1] == "lower")
	    	{
		    	tradeoff = tradeoff_compromise;
		    }
		
	    	critiqueDict.push({'attribute':critique[0], 'tradeoff':tradeoff});
    	}
	    let firstTerm = 0;
	    for (let a=0; a<critiqueDict.length; a++)
	    {
	    	let attribute = critiqueDict[a]['attribute'];
	    	firstTerm += user.attributeWeight[attribute] * critiqueDict[a]['tradeoff'];
	    }
	    let secondTerm = 0;
	    for (let i = 0; i < critique2ItemSet.length; i++)
	    {
	    	secondTerm += critique2ItemSet[i]['utility'];
	    }
	    secondTerm = secondTerm/critique2ItemSet.length;

	    tradeoffUtility = firstTerm * secondTerm;
        
		critiqueUtilityDict.push({'critique':critique, 'tradeoffUtility':tradeoffUtility});
		
		allCritique2ItemDict.push({'critique':critique, 'itemSet':critique2ItemSet}); // used to get recommender item when proposing critiques
    
    }
	
	return {'critiqueUtilityDict':critiqueUtilityDict, 'allCritique2ItemDict': allCritique2ItemDict};
}



// ------------------------------------------------------------------
// Diversity Utility
// ------------------------------------------------------------------
function computeDiversityUtility(critiqueSet, critiqueUtilityDict, allCritique2ItemDict)
{
    let diversityDegreeDict = [];
    let diversityUtilityDict = [] ;
    for (let critique of critiqueSet)
	{
        
        let critiqueUtilityObject = _.find(critiqueUtilityDict, {'critique': critique});
        let critiqueUtility = critiqueUtilityObject['tradeoffUtility'];
        let critique2ItemSetObject = _.find(allCritique2ItemDict, {'critique': critique});
        let critique2ItemSet = critique2ItemSetObject['itemSet'];

        let diversity = 0;
        let diversityArray = [];
		for (let critique2 of critiqueSet)
	    {   
            if (_.isEqual(critique, critique2))
            {
                continue;
            }
            else{
                let critique2ItemSetObject2 = _.find(allCritique2ItemDict, {'critique': critique2});
                let critique2ItemSet2 = critique2ItemSetObject2['itemSet'];
                
                // union of critique and critique2
                union_critique = _.union(critique, critique2);
                union_critiqueItemSet = _.union(critique2ItemSet, critique2ItemSet2);
                let diversity = (1 - union_critique.length/critique.length) * (1 - union_critiqueItemSet.length/critique2ItemSet.length);
                diversityArray.push(diversity);
            }
        }
        diversity = Math.min(diversityArray);
        let diversityUtility = diversity * critiqueUtility;
        diversityDegreeDict.push({'critique':critique, 'diversity':diversity});
        diversityUtilityDict.push({'critique':critique, 'diversityUtility':diversityUtility});
    }
    return diversityUtilityDict;

}





module.exports = (user, itemData, topRecItem, nominalAttributes, numericalAttributes, numfCompoundCritiques, supportValue, numOfUtilityCritiques, numOfDiversifiedCritiques) => {

    // Get topRecItem 
    //console.log('Top Recommended Item ID : '+ topRecItem['id'] );

    // Use Apriori Algorithms to obtain frequent-critique-itemsets
	
	//console.log("-------   Step A:   Find Frequent Set  ---------");

    itemCritique = getItemCritique(itemData, topRecItem, nominalAttributes, numericalAttributes);
    itemCritiqueArray = itemCritique['itemCritiqueArray'];
    itemCritiqueDict = itemCritique['itemCritiqueDict'];

	// find frequent set -- the package should be checked  !!!!
	let frequentCritiqueSet = fi(itemCritiqueArray,  supportValue, numfCompoundCritiques,  true);
	console.log(frequentCritiqueSet.length);

	//console.log("-----   Step B:   Select Favor Critique  -------");

    // select the favor critique by computing the tradeoff utility
    
    let utilityDict = MAUT(user, itemData, numericalAttributes, nominalAttributes);

    let critiqueUtility = computeTradeoffUtility(user, frequentCritiqueSet, itemCritiqueDict, utilityDict);
	
	let critiqueUtilityDict = critiqueUtility['critiqueUtilityDict'];
	let allCritique2ItemDict = critiqueUtility['allCritique2ItemDict'];
    
    
    // Diversity degree 
    let diversityUtilityDict =  computeDiversityUtility(frequentCritiqueSet, critiqueUtilityDict, allCritique2ItemDict);


    // sort the tradeoffUtility for critiques

	let sortCritiqueUtility = _.orderBy(critiqueUtilityDict, ['tradeoffUtility'], ['desc']);
	let favorCritique = []; 
	for (let i=0; i< numOfUtilityCritiques; i++)
	{
		favorCritique.push(sortCritiqueUtility[i]['critique']);
	}
	console.log("Favor Critique: "+ favorCritique);

    // get diversify critique
    let sortDiversityUtility = _.orderBy(diversityUtilityDict, ['diversityUtility'], ['desc']);
	let diversifyCritique = [];
	for (let i=0; i< numOfDiversifiedCritiques; i++)
	{
		diversifyCritique.push(sortDiversityUtility[i]['critique']);
	}

	return {'favorCritique': favorCritique, 'diversifyCritique': diversifyCritique }   


}


