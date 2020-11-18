import React from "react";
import icon from "../icon";
import request from "../../services/request";
import "./search.css";

interface SearchProp {
    basePath: string;
    onItemSelected?: Function;
}

interface SearchState {
    query: string;
    result: { name: string; path: string }[];
    showSearchLoader: boolean;
    showSearchBox: boolean;
}

class Search extends React.Component<SearchProp, SearchState> {
    state: SearchState = {
        query: "",
        result: [],
        showSearchLoader: false,
        showSearchBox: false,
    };

    constructor(props: SearchProp) {
        super(props);
    }

    runDebounce = this.debounce(this.doSearch, 1000);

    debounce(fn: Function, delay: number) {
        let timer: NodeJS.Timeout;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(this, arguments);
            }, delay);
        };
    }

    async doSearch(query: string) {
        if (!query) {
            this.setState({
                query: "",
                result: [],
                showSearchBox: false,
                showSearchLoader: false,
            });
            return;
        }

        const dirPath = this.props.basePath;
        const result = await request.search(dirPath, query);

        this.setState({
            query,
            result,
            showSearchBox: true,
            showSearchLoader: false,
        });
    }

    handleChange = (query: string) => {
        if (!query) {
            this.setState({
                query: "",
            });
            return;
        }

        this.setState({
            query,
            showSearchBox: true,
            showSearchLoader: true,
        });
    };

    clearSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const keyCode = event.which || event.keyCode;
        if (keyCode === 27) {
            // Clear search
            this.setState({
                query: "",
                result: [],
                showSearchBox: false,
            });
        }
    };

    showResults = () => {
        return (
            <div className="item-wrapper search-results">
                {this.state.result.map((item) => (
                    <div
                        onClick={() => this.props.onItemSelected(item)}
                        key={item.path}
                        className="indent mb search-item"
                    >
                        <div>
                            {icon.file(item)} <span>{item.name}</span>
                        </div>
                        <div className="search-path">{item.path}</div>
                    </div>
                ))}
            </div>
        );
    };

    emptyResults = () => {
        return (
            <div className="item-wrapper search-results empty-results">
                <span className="tomato">{icon.close()}</span> No Matching Results
            </div>
        );
    };

    loadingResults = () => {
        return <div className="item-wrapper search-results empty-results">{icon.loading()}</div>;
    };

    results = () => {
        if (this.state.showSearchLoader) {
            return this.loadingResults();
        }

        if (this.state.result.length > 0) {
            return this.showResults();
        }

        return this.emptyResults();
    };

    render() {
        return (
            <div className="search-wrapper">
                <span className="search-icon">{icon.search()}</span>
                <input
                    type="text"
                    className="fa search"
                    placeholder="Search"
                    onChange={(event) => {
                        this.handleChange(event.target.value);
                        this.runDebounce();
                    }}
                    onKeyDown={this.clearSearch}
                    value={this.state.query}
                />
                <div style={{ display: this.state.showSearchBox ? "block" : "none" }}>
                    {this.results()}
                </div>
            </div>
        );
    }
}

export default Search;
