export default `{{#if query }}
query {
{{#each query}}
  {{escapedString @key true}} = {{escapedString this}}
{{/each}}
}
{{/if }}
{{#if headers }}
headers {
{{#each headers}}
  {{escapedString @key true}} = {{escapedString this}}
{{/each}}
}
{{/if }}
{{#if body }}
body {{#ifeq body.modelType "Scalar"}}{{>Scalar body.model }}{{/ifeq}}{{#ifeq body.modelType "Object"}}{{>Object body use=" =" indent=0 }}{{/ifeq}}{{#ifeq body.modelType "List"}}{{>Array body use=":" indent=0 }}{{/ifeq}}{{newLine 2}}
{{/if }}`;

// curl --location --request PUT https://swapi.dev/api/movie --header 'Content-Type: application/json' --data '{ "updateData": { "base": "premiere", "seasonsInfo": 22, "budget": true}, "query": {} }'

// curl 'https://swapi.dev/api/graphql/?operationName=FilmBaseInfo' -X POST -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:104.0) Gecko/20100101 Firefox/104.0' -H 'Accept: */*' -H 'Accept-Language: ru,en;q=0.9' -H 'Accept-Encoding: gzip, deflate, br' -H 'Referer: https://openmovieapi.dev/' -H 'content-type: application/json' -H 'service-id: 25' -H 'x-request-id: 166031276411-679812349' -H 'uber-trace-id: 8e5132b:0:1' -H 'Origin: https://openmovieapi.dev' -H 'Connection: keep-alive' -H 'Cookie: i=Jy93245MHadsfadfgMuo/1kIcvbn84nHvv/AQpvlEmn73sdfhp8iCY=; _ym_uid=16457345044; _ym_d=1645209; yandex_login=mdwit0; yandexuid=4532455; mda2_beacon=16653095; mda_exp_enabled=1; my_perpages=%7Bghkj0%7D; _yasc=VjEU677LoI1G1bqFXTDy7vE4Q==; crookie=YrfNwLmlCQhgjYPFXeKGnNavrH+1RG04TkAQelUTHsY=; gdpr=0; yuidss=4555; mustsee_sort_v5=01.10.200.211.101.111; stars_sort_v5=01.170.10.70.181; users_info[check_sh_bool]=none; ya_sess_id=3:1660471313.3:VCD1bQ:82.1.2:1|3.2.2:210153|1613236635|30:1020941SjYu_EHn9aeUg; yp=1660557717.yu.45512507716; ymex=16617.oyu.455785; location=1; ys=udn.cDDA%3D#c_chck.94; sso_status=sso.passport.yandex.ru:synchronized; _ym_isad=1; cmtchd=MTY2MDQ3MTMxOTI4MA==; PHPSESSID=a76a5fghj8ghfj97; yandex_gid=10522; tc=1; uid=22500473; mobile=no; _ym_visorc=b; user_country=ot' -H 'Sec-Fetch-Dest: empty' -H 'Sec-Fetch-Mode: cors' -H 'Sec-Fetch-Site: same-site' -H 'TE: trailers' --data-raw '{"operationName":"FilmBaseInfo","variables":{"filmId":1249527,"isAuthorized":true,"kpCityId":1,"promotionsConfig":{"configVersion":"1.0","platform":"kp"},"actorsLimit":10,"voiceOverActorsLimit":5,"relatedMoviesLimit":14,"mediaBillingTarget":"kp-0522"},"query":"query FilmBaseInfo($filmId: Long!, $isAuthorized: Boolean!, $kpCityId: Int!, $promotionsConfig: PromotionConfigFilterInput!, $mediaBillingTarget: String!, $actorsLimit: Int, $voiceOverActorsLimit: Int, $relatedMoviesLimit: Int) {}"}'