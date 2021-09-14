import html
import json
from selenium import webdriver

FACEBOOK_DOMAIN = 'https://www.facebook.com'
HACKERCUP_URL_PREFIX = '/codingcompetitions/hacker-cup'
BASE_URL = f'{FACEBOOK_DOMAIN}{HACKERCUP_URL_PREFIX}'

driver = webdriver.Firefox()
driver.implicitly_wait(10)


def crawl_seasons():
    season_names = set()

    driver.get(f'{BASE_URL}')
    driver.find_elements_by_xpath(
        f"//a[contains(@href, '{HACKERCUP_URL_PREFIX}/2011')]")
    for elem in driver.find_elements_by_xpath(f"//a[contains(@href, '{HACKERCUP_URL_PREFIX}/2')]"):
        season_names.add(elem.get_attribute('href')[len(BASE_URL):][1:5])

    return [{'name': season_name,
             'url': f'{BASE_URL}/{season_name}'}
            for season_name in sorted(season_names, reverse=True)]


def crawl_contests(season):
    contest_names = []

    driver.get(season['url'])
    for elem in driver.find_elements_by_xpath(f"//a[contains(@href, '{HACKERCUP_URL_PREFIX}/{season['name']}/')]"):
        contest_name = elem.get_attribute(
            'href')[len(f"{BASE_URL}/{season['name']}/"):]
        if contest_name not in contest_names:
            contest_names.append(contest_name)

    return [{'name': contest_name,
             'url': f"{BASE_URL}/{season['name']}/{contest_name}"}
            for contest_name in contest_names]


def crawl_problem_name(problem_url):
    driver.get(problem_url)

    title = driver.find_element_by_xpath(
        "//div[contains(@class, 'ogxn7k6r') and contains(@class, 'l1vn1z3k') and contains(@class, 'epv921xz') and contains(@class, 'f1as3fko')]").text

    return title[title.find(':') + 2:]


def crawl_problems(season, contest):
    problem_urls = []

    driver.get(contest['url'])
    for elem in driver.find_elements_by_xpath(f"//a[contains(@href, '{HACKERCUP_URL_PREFIX}/{season['name']}/{contest['name']}/problems/')]"):
        problem_urls.append(elem.get_attribute('href'))

    return [{'name': crawl_problem_name(problem_url),
             'url': problem_url}
            for problem_url in problem_urls]


def main():
    dataset = {
        'seasons': crawl_seasons()
    }

    for season in dataset['seasons']:
        season['contests'] = crawl_contests(season)

        for contest in season['contests']:
            contest['problems'] = crawl_problems(season, contest)

    with open('hackercup_dataset.json', 'w') as f:
        json.dump(dataset, f, indent=4)

    driver.close()


if __name__ == "__main__":
    main()
