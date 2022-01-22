import React, { useRef, useState } from 'react'
import { notification } from 'antd'
import { useLazyQuery, gql, NetworkStatus } from '@apollo/client'
import _ from 'lodash'

export const SearchContext = React.createContext()

export const SearchResultStatus = {
    NO_SEARCH:  'NO_SEARCH',
    NO_RESULTS: 'NO_RESULTS',
    ERROR:      'ERROR',
    LOADING:    'LOADING',
    READY:      'READY'
}

const PAGE_SIZE = 8
const AUTOMATIC_UPDATE_DELAY_MS = 100

export const useSearch = () => {

    // Maintain state of active filters, active sorter, search results
    
    const [isFirstSearch, setFirstSearch] = useState(true) // TODO : consider if this could be replaced by the { called } field returned by useLazyQuery

    const [searchFilters, setSearchFilters] = useState({
        priceRange: [0, 500000],
        zipCodes: [1030, 1140],
        onlyWithGarden: false,
        minGardenArea: undefined,
        immowebCode: undefined,
        freeText: undefined,
        minLivingArea: 0,
        minBedroomCount: 0
    })

    const [resultSorter, setResultSorter] = useState({field: 'modificationDate', order: 'descend'})

    // Load estates with active filters
    const [fetch, { loading, networkStatus, error, data, fetchMore }] = useLazyQuery(gql`
        query estates(
            $priceRange: [Int],
            $zipCodes: [Int],
            $freeText: String,
            $onlyWithGarden: Boolean,
            $minGardenArea: Int,
            $minLivingArea: Int,
            $minBedroomCount: Int,
            $onlyStillAvailable: Boolean
            $immowebCode: Int,            
            $orderBy: OrderByInput,
            $limit: Int,
            $offset: Int
        ) {

            estates(priceRange: $priceRange, 
                    zipCodes: $zipCodes,
                    freeText: $freeText,
                    onlyWithGarden: $onlyWithGarden,
                    minGardenArea: $minGardenArea,
                    minLivingArea: $minLivingArea,
                    minBedroomCount: $minBedroomCount,
                    onlyStillAvailable: $onlyStillAvailable
                    immowebCode: $immowebCode,
                    orderBy: $orderBy,
                    limit: $limit,
                    offset: $offset) {
                totalCount
                page {
                    immowebCode
                    price
                    zipCode
                    locality
                    images
                    modificationDate
                    hasGarden
                    gardenArea
                    agencyLogo
                    agencyName
                    geolocation
                    street
                    streetNumber
                    isAuction
                    isSold
                    isUnderOption
                    description
                    livingArea
                    bedroomCount
                    isLiked
                    isVisited
                    priceHistory {
                        price
                        date
                    }
                }
            }
        }
    `,
    {
        notifyOnNetworkStatusChange: true
    })

    // Fetch estates with search filter
    const fetchResults = (searchFilters, resultSorter) => {
        
        clearTimeout(interval.current)

        const {
            priceRange,
            zipCodes,
            freeText,
            onlyWithGarden,
            minGardenArea,
            minLivingArea,
            minBedroomCount,
            onlyStillAvailable,
            immowebCode
        } = searchFilters

        const variables = {
            ...searchFilters,
            priceRange: priceRange?.[1] ? priceRange : priceRange?.[0] ? [priceRange[0], 99999999] : [0, 99999999],
            zipCodes: zipCodes?.length ? zipCodes : undefined,
            freeText: freeText === "" ? undefined : freeText,
            onlyWithGarden: onlyWithGarden || undefined,
            minGardenArea: onlyWithGarden && minGardenArea > 0 ? minGardenArea : undefined,
            minLivingArea: minLivingArea > 0 ? minLivingArea : undefined,
            minBedroomCount: minBedroomCount > 0 ? minBedroomCount : undefined,
            onlyStillAvailable: onlyStillAvailable || undefined,
            immowebCode: immowebCode || undefined,
            orderBy: resultSorter,
            limit: PAGE_SIZE
        }

        /*notification.open({
            message: 'Search ongoing...',
            description: <pre>{JSON.stringify(variables, null, 2)}</pre>,
            placement: 'bottomLeft',
            duration: 5
        })*/

        fetch({ variables })

        setFirstSearch(false)
    }

    // Fetch with a delay
    const interval = useRef()
    const fetchResultsLater = (searchFilters, resultSorter) => {
        if(interval.current) {
            clearTimeout(interval.current)
        }
        interval.current = setTimeout(() => {
            fetchResults(searchFilters, resultSorter)
        }, AUTOMATIC_UPDATE_DELAY_MS)
    }

    // Set a filter
    const setFilter = (name, value) => {
        if(!_.isEqual(searchFilters[name], value)) {
            const newSearchFilters = {...searchFilters, [name]: value}
            setSearchFilters(newSearchFilters)
            fetchResultsLater(newSearchFilters, resultSorter)
        }
    }

    // Clear all filters
    const clearFilters = () => {
        if(searchFilters !== {}) {
            setSearchFilters({})
            fetchResultsLater({}, resultSorter)
        }
    }

    // Set a sorter
    const setSorter = (sorter) => {
        setResultSorter(sorter)
        fetchResults(searchFilters, sorter)
    }

    console.log("Loading = " + loading + " and network status = " + networkStatus)

    return {
        
        isFirstSearch,

        searchFilters,
        setFilter,
        clearFilters,

        resultSorter,
        setSorter,

        fetchResults: (customFilters, customSorter) => fetchResults(customFilters || searchFilters, customSorter || resultSorter),
        fetchNext: () => fetchMore({variables: {limit: PAGE_SIZE, offset: data?.estates?.page?.length || 0}}),
        
        searchResults: data?.estates?.page,
        resultCount: data?.estates?.totalCount,

        // TODO : consider using directly the different network statuses : https://github.com/apollographql/apollo-client/blob/main/src/core/networkStatus.ts
        searchStatus: (loading && networkStatus !== NetworkStatus.fetchMore) ?   SearchResultStatus.LOADING
                    : error                             ?   SearchResultStatus.ERROR
                    : data?.estates?.estates?.length    ?   SearchResultStatus.READY
                    : isFirstSearch                     ?   SearchResultStatus.NO_SEARCH
                    :                                       SearchResultStatus.NO_RESULTS,
        error
    }

}