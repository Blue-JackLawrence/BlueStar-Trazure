package com.trazure.trazurebackend.controller;

import com.trazure.trazurebackend.entity.User;
import com.trazure.trazurebackend.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController // 告诉 Spring 这是一个对外提供 API 的入口
public class TestController {

    @Autowired // 自动把我们刚才写的 UserMapper 注入进来
    private UserMapper userMapper;

    @GetMapping("/test/users") // 浏览器访问地址
    public List<User> getAllUsers() {
        // selectList(null) 意味着查询所有，没有 where 条件
        // 这行代码等同于 SQL: SELECT * FROM users;
        return userMapper.selectList(null);
    }
}